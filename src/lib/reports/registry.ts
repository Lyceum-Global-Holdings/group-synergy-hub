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
  /** Optional sub-grouping shown in the Reports Center (Inventory / Movement / Compliance / Assets) */
  group?: string;
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
      type: "dateRange";
      required?: boolean;
      /** Default span in days back from today, e.g. 30 */
      defaultDays?: number;
    }
  | {
      key: string;
      label: string;
      type: "location" | "category" | "supplier";
      required?: boolean;
    }
  | {
      key: string;
      label: string;
      type: "text";
      placeholder?: string;
      required?: boolean;
    }
  | {
      key: string;
      label: string;
      type: "select";
      options: { value: string; label: string }[];
      defaultValue?: string;
    }
  | {
      key: string;
      label: string;
      type: "boolean";
      defaultValue?: boolean;
    };

export const REPORT_REGISTRY: ReportDefinition[] = [
  // ============ WAREHOUSE — INVENTORY ============
  {
    code: "WH-STK-OH-001",
    title: "Stock on Hand",
    description: "Current stock per item with location, category and value at unit cost.",
    moduleKey: "warehouse",
    group: "Inventory",
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
    group: "Inventory",
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
    group: "Inventory",
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
  {
    code: "WH-ABC-001",
    title: "ABC / Pareto Classification",
    description: "Items classified A/B/C by 12-month consumption value (80/15/5 cumulative).",
    moduleKey: "warehouse",
    group: "Inventory",
    standard: "ISO 55000",
    hookId: "warehouse.abcClassification",
    parameters: [{ key: "categoryId", label: "Category", type: "category" }],
    columns: [
      { key: "item_code", label: "Item Code", type: "string", width: 18 },
      { key: "item_name", label: "Item Name", type: "string", width: 36 },
      { key: "category_name", label: "Category", type: "string", width: 22 },
      { key: "consumption_qty", label: "Consumption Qty", type: "number", width: 16, align: "right" },
      { key: "consumption_value", label: "Consumption Value", type: "currency", width: 18, align: "right" },
      { key: "cumulative_pct", label: "Cumulative %", type: "percent", width: 14, align: "right" },
      { key: "abc_class", label: "Class", type: "string", width: 8, align: "center" },
    ],
  },

  // ============ WAREHOUSE — MOVEMENT ============
  {
    code: "WH-MOV-001",
    title: "Stock Movement Ledger",
    description: "Chronological ledger of every stock transaction within a period.",
    moduleKey: "warehouse",
    group: "Movement",
    standard: "ISO 8601 period",
    hookId: "warehouse.stockMovement",
    parameters: [
      { key: "period", label: "Period", type: "dateRange", defaultDays: 30 },
      { key: "locationId", label: "Location", type: "location" },
    ],
    columns: [
      { key: "txn_date", label: "Date", type: "datetime", width: 22 },
      { key: "item_code", label: "Item Code", type: "string", width: 18 },
      { key: "item_name", label: "Item Name", type: "string", width: 32 },
      { key: "transaction_type", label: "Txn Type", type: "string", width: 18 },
      { key: "reference_type", label: "Reference", type: "string", width: 14 },
      { key: "quantity_change", label: "Qty Δ", type: "number", width: 12, align: "right" },
      { key: "quantity_before", label: "Before", type: "number", width: 12, align: "right" },
      { key: "quantity_after", label: "After", type: "number", width: 12, align: "right" },
      { key: "unit_cost", label: "Unit Cost", type: "currency", width: 14, align: "right" },
      { key: "total_value", label: "Value", type: "currency", width: 14, align: "right" },
      { key: "location_name", label: "Location", type: "string", width: 20 },
      { key: "user_email", label: "User", type: "string", width: 26 },
    ],
  },

  // ============ WAREHOUSE — COMPLIANCE ============
  {
    code: "WH-CYC-VAR-001",
    title: "Cycle Count Variance",
    description: "Items with a non-zero variance between system and physical counts.",
    moduleKey: "warehouse",
    group: "Compliance",
    standard: "ISO 9001 §8.7",
    hookId: "warehouse.cycleCountVariance",
    parameters: [
      { key: "period", label: "Count Date Range", type: "dateRange", defaultDays: 90 },
      { key: "locationId", label: "Location", type: "location" },
    ],
    columns: [
      { key: "count_number", label: "Count #", type: "string", width: 18 },
      { key: "count_date", label: "Date", type: "date", width: 14 },
      { key: "status", label: "Status", type: "string", width: 14 },
      { key: "location_name", label: "Location", type: "string", width: 22 },
      { key: "item_code", label: "Item Code", type: "string", width: 18 },
      { key: "item_name", label: "Item Name", type: "string", width: 32 },
      { key: "system_quantity", label: "System Qty", type: "number", width: 14, align: "right" },
      { key: "physical_quantity", label: "Physical Qty", type: "number", width: 14, align: "right" },
      { key: "variance_quantity", label: "Variance Qty", type: "number", width: 14, align: "right" },
      { key: "variance_value", label: "Variance Value", type: "currency", width: 16, align: "right" },
      { key: "variance_percentage", label: "Variance %", type: "percent", width: 12, align: "right" },
      { key: "variance_reason", label: "Reason", type: "string", width: 30 },
    ],
  },
  {
    code: "WH-BIN-UTL-001",
    title: "Bin Utilisation",
    description: "Capacity vs. fill level for every bin, sorted by utilisation %.",
    moduleKey: "warehouse",
    group: "Compliance",
    standard: "WMS best practice",
    hookId: "warehouse.binUtilisation",
    parameters: [{ key: "locationId", label: "Location", type: "location" }],
    columns: [
      { key: "bin_code", label: "Bin Code", type: "string", width: 16 },
      { key: "bin_name", label: "Bin Name", type: "string", width: 28 },
      { key: "location_name", label: "Location", type: "string", width: 22 },
      { key: "capacity", label: "Capacity", type: "number", width: 12, align: "right" },
      { key: "current_quantity", label: "Current", type: "number", width: 12, align: "right" },
      { key: "available_capacity", label: "Available", type: "number", width: 12, align: "right" },
      { key: "utilisation_pct", label: "Utilisation %", type: "percent", width: 14, align: "right" },
      { key: "status", label: "Status", type: "string", width: 12 },
    ],
  },

  // ============ WAREHOUSE — PROCUREMENT INTAKE ============
  {
    code: "WH-GRN-REG-001",
    title: "GRN Register",
    description: "Goods Receipt Notes within a period with supplier, value and line counts.",
    moduleKey: "warehouse",
    group: "Receipts",
    standard: "WCO trade docs",
    hookId: "warehouse.grnRegister",
    parameters: [{ key: "period", label: "GRN Date Range", type: "dateRange", defaultDays: 60 }],
    columns: [
      { key: "grn_number", label: "GRN #", type: "string", width: 18 },
      { key: "grn_date", label: "GRN Date", type: "date", width: 14 },
      { key: "po_number", label: "PO #", type: "string", width: 18 },
      { key: "invoice_number", label: "Invoice #", type: "string", width: 18 },
      { key: "invoice_date", label: "Invoice Date", type: "date", width: 14 },
      { key: "supplier_name", label: "Supplier", type: "string", width: 30 },
      { key: "status", label: "Status", type: "string", width: 14 },
      { key: "line_count", label: "Lines", type: "integer", width: 8, align: "right" },
      { key: "total_qty_received", label: "Total Qty", type: "number", width: 14, align: "right" },
      { key: "total_value", label: "Total Value", type: "currency", width: 16, align: "right" },
      { key: "approved_at", label: "Approved", type: "datetime", width: 22 },
    ],
  },

  // ============ WAREHOUSE — ASSETS & TOOLS ============
  {
    code: "WH-AST-REG-001",
    title: "Asset Register (with depreciation)",
    description: "Fixed asset register with acquisition cost, depreciation, and net book value.",
    moduleKey: "warehouse",
    group: "Assets",
    standard: "ISO 55000 / IAS 16",
    hookId: "warehouse.assetRegister",
    parameters: [
      { key: "locationId", label: "Location", type: "location" },
      {
        key: "status",
        label: "Status",
        type: "select",
        options: [
          { value: "all", label: "All statuses" },
          { value: "active", label: "Active" },
          { value: "in_repair", label: "In Repair" },
          { value: "disposed", label: "Disposed" },
        ],
        defaultValue: "all",
      },
    ],
    columns: [
      { key: "asset_id", label: "Asset ID", type: "string", width: 16 },
      { key: "name", label: "Name", type: "string", width: 30 },
      { key: "category", label: "Category", type: "string", width: 22 },
      { key: "brand", label: "Brand", type: "string", width: 18 },
      { key: "serial_number", label: "Serial #", type: "string", width: 18 },
      { key: "asset_tag", label: "Tag", type: "string", width: 14 },
      { key: "location_name", label: "Location", type: "string", width: 22 },
      { key: "status", label: "Status", type: "string", width: 12 },
      { key: "condition", label: "Condition", type: "string", width: 12 },
      { key: "purchase_date", label: "Purchase Date", type: "date", width: 14 },
      { key: "purchase_price", label: "Cost", type: "currency", width: 14, align: "right" },
      { key: "depreciation_method", label: "Method", type: "string", width: 14 },
      { key: "depreciation_rate", label: "Rate %", type: "percent", width: 10, align: "right" },
      { key: "useful_life_years", label: "Life (yrs)", type: "integer", width: 10, align: "right" },
      { key: "salvage_value", label: "Salvage", type: "currency", width: 12, align: "right" },
      { key: "accumulated_depreciation", label: "Accum Dep.", type: "currency", width: 14, align: "right" },
      { key: "net_book_value", label: "NBV", type: "currency", width: 14, align: "right" },
    ],
  },
  {
    code: "WH-TOOL-LED-001",
    title: "Tool Issue / Return Ledger",
    description: "Tool issues with return status, outstanding quantity and last condition.",
    moduleKey: "warehouse",
    group: "Assets",
    standard: "ISO 55000",
    hookId: "warehouse.toolLedger",
    parameters: [
      { key: "period", label: "Issue Date Range", type: "dateRange", defaultDays: 60 },
      {
        key: "status",
        label: "Status",
        type: "select",
        options: [
          { value: "all", label: "All statuses" },
          { value: "issued", label: "Issued" },
          { value: "partial", label: "Partially Returned" },
          { value: "returned", label: "Returned" },
          { value: "overdue", label: "Overdue" },
        ],
        defaultValue: "all",
      },
    ],
    columns: [
      { key: "issue_number", label: "Issue #", type: "string", width: 18 },
      { key: "issue_date", label: "Issue Date", type: "date", width: 14 },
      { key: "tool_code", label: "Tool Code", type: "string", width: 16 },
      { key: "tool_name", label: "Tool", type: "string", width: 28 },
      { key: "issued_to_name", label: "Issued To", type: "string", width: 24 },
      { key: "department", label: "Department", type: "string", width: 18 },
      { key: "expected_return_date", label: "Expected Return", type: "date", width: 14 },
      { key: "quantity_issued", label: "Qty Issued", type: "integer", width: 10, align: "right" },
      { key: "quantity_returned", label: "Qty Returned", type: "integer", width: 10, align: "right" },
      { key: "outstanding_qty", label: "Outstanding", type: "integer", width: 10, align: "right" },
      { key: "status", label: "Status", type: "string", width: 14 },
      { key: "last_return_date", label: "Last Return", type: "date", width: 14 },
      { key: "last_condition", label: "Condition", type: "string", width: 14 },
    ],
  },

  // ============ WAREHOUSE — TRACEABILITY ============
  {
    code: "WH-BATCH-TRC-001",
    title: "Batch Traceability (forward + backward)",
    description: "Forward (issues) and backward (GRN) trace for a batch number or item code.",
    moduleKey: "warehouse",
    group: "Compliance",
    standard: "GS1 CTE/KDE · ISO 22005",
    hookId: "warehouse.batchTraceability",
    parameters: [
      { key: "batchNumber", label: "Batch Number", type: "text", placeholder: "e.g. BATCH-2026-0001" },
      { key: "itemCode", label: "Item Code", type: "text", placeholder: "e.g. ELC-0001" },
      {
        key: "direction",
        label: "Direction",
        type: "select",
        options: [
          { value: "both", label: "Both" },
          { value: "backward", label: "Backward (origin)" },
          { value: "forward", label: "Forward (downstream)" },
        ],
        defaultValue: "both",
      },
    ],
    columns: [
      { key: "trace_direction", label: "Direction", type: "string", width: 12 },
      { key: "event_date", label: "Event Date", type: "datetime", width: 22 },
      { key: "event_type", label: "Event", type: "string", width: 18 },
      { key: "reference_number", label: "Reference", type: "string", width: 22 },
      { key: "batch_number", label: "Batch #", type: "string", width: 20 },
      { key: "item_code", label: "Item Code", type: "string", width: 18 },
      { key: "item_name", label: "Item Name", type: "string", width: 30 },
      { key: "quantity", label: "Qty", type: "number", width: 12, align: "right" },
      { key: "unit_cost", label: "Unit Cost", type: "currency", width: 14, align: "right" },
      { key: "counterparty", label: "Counterparty", type: "string", width: 26 },
      { key: "notes", label: "Notes", type: "string", width: 36 },
    ],
  },
];

export function getReportsByModule(moduleKey: string): ReportDefinition[] {
  return REPORT_REGISTRY.filter((r) => r.moduleKey === moduleKey);
}

export function getReport(code: string): ReportDefinition | undefined {
  return REPORT_REGISTRY.find((r) => r.code === code);
}

/** Group reports by their .group field within a module. */
export function groupReports(list: ReportDefinition[]): Record<string, ReportDefinition[]> {
  return list.reduce<Record<string, ReportDefinition[]>>((acc, r) => {
    const key = r.group ?? "General";
    (acc[key] ||= []).push(r);
    return acc;
  }, {});
}
