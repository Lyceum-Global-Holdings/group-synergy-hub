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
      /** Bin picker — scoped to the value of another parameter (typically locationId). */
      type: "bin";
      /** Sibling param key whose value scopes the bin list (e.g. "locationId"). */
      dependsOn: string;
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
    }
  | {
      key: string;
      label: string;
      /**
       * Composite text filter with an operator dropdown
       * (contains / equals / startsWith / endsWith / notContains).
       * Value shape: { op: NotesFilterOp; term: string }
       */
      type: "textOperator";
      placeholder?: string;
      /** Column key to highlight in the preview when a match is found. */
      highlightColumn: string;
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
      { key: "binId", label: "Bin", type: "bin", dependsOn: "locationId" },
      { key: "categoryId", label: "Category", type: "category" },
      { key: "binWise", label: "Show bin-wise breakdown", type: "boolean", defaultValue: false },
      { key: "includeZero", label: "Include zero-stock items", type: "boolean", defaultValue: false },
    ],
    columns: [
      { key: "item_code", label: "Item Code", type: "string", width: 18 },
      { key: "item_name", label: "Item Name", type: "string", width: 36 },
      { key: "category_name", label: "Category", type: "string", width: 22 },
      { key: "location_name", label: "Location", type: "string", width: 22 },
      { key: "bin_code", label: "Bin Code", type: "string", width: 14 },
      { key: "bin_name", label: "Bin Name", type: "string", width: 22 },
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
  {
    code: "WH-PP-OH-001",
    title: "Partial Pieces on Hand",
    description: "Live snapshot of partial-piece handling units (SAP EWM HU / IAS 2) with size × pieces, valuation and ageing.",
    moduleKey: "warehouse",
    group: "Inventory",
    standard: "IAS 2 / SAP EWM HU",
    hookId: "warehouse.partialPiecesOnHand",
    parameters: [
      { key: "locationId", label: "Location", type: "location" },
      { key: "binId", label: "Bin", type: "bin", dependsOn: "locationId" },
      { key: "categoryId", label: "Category", type: "category" },
      {
        key: "status",
        label: "Status",
        type: "select",
        options: [
          { value: "available", label: "Available" },
          { value: "reserved", label: "Reserved" },
          { value: "all", label: "All statuses" },
        ],
        defaultValue: "available",
      },
      { key: "includeZero", label: "Include depleted (piece_count = 0)", type: "boolean", defaultValue: false },
    ],
    columns: [
      { key: "piece_code", label: "Piece Code", type: "string", width: 18 },
      { key: "item_code", label: "Item Code", type: "string", width: 18 },
      { key: "item_name", label: "Item Name", type: "string", width: 30 },
      { key: "category_name", label: "Category", type: "string", width: 20 },
      { key: "location_name", label: "Location", type: "string", width: 20 },
      { key: "bin_code", label: "Bin", type: "string", width: 14 },
      { key: "size_value", label: "Size", type: "number", width: 10, align: "right" },
      { key: "size_uom", label: "UoM", type: "string", width: 8 },
      { key: "piece_count", label: "Pieces", type: "integer", width: 10, align: "right" },
      { key: "total_size", label: "Total", type: "number", width: 12, align: "right" },
      { key: "unit_cost", label: "Unit Cost", type: "currency", width: 14, align: "right" },
      { key: "stock_value", label: "Stock Value", type: "currency", width: 16, align: "right" },
      { key: "batch_number", label: "Batch", type: "string", width: 16 },
      { key: "status", label: "Status", type: "string", width: 12 },
      { key: "age_days", label: "Age (d)", type: "integer", width: 10, align: "right" },
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
      {
        key: "notesFilter",
        label: "Notes filter",
        type: "textOperator",
        placeholder: 'e.g. Bulk stock upload  (use "quotes" to AND extra terms)',
        highlightColumn: "notes",
      },
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
      { key: "notes", label: "Notes", type: "string", width: 36 },
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
      {
        key: "notesFilter",
        label: "Variance reason filter",
        type: "textOperator",
        placeholder: 'e.g. physical recount  (use "quotes" to AND extra terms)',
        highlightColumn: "variance_reason",
      },
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
      {
        key: "notesFilter",
        label: "Notes filter",
        type: "textOperator",
        placeholder: 'e.g. GRN-2026  (use "quotes" to AND extra terms)',
        highlightColumn: "notes",
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

  // ============================================================
  // FINANCE
  // ============================================================
  {
    code: "FN-TB-001",
    title: "Trial Balance",
    description: "All active accounts with opening, period movement, and closing balances as of a date.",
    moduleKey: "finance", group: "Ledger", standard: "IFRS presentation",
    hookId: "finance.trialBalance",
    parameters: [{ key: "asOfDate", label: "As of date", type: "date" }],
    columns: [
      { key: "account_code", label: "Account", type: "string", width: 14 },
      { key: "account_name", label: "Name", type: "string", width: 36 },
      { key: "account_type", label: "Type", type: "string", width: 14 },
      { key: "account_category", label: "Category", type: "string", width: 16 },
      { key: "opening_balance", label: "Opening", type: "currency", width: 14, align: "right" },
      { key: "period_debit", label: "Debit", type: "currency", width: 14, align: "right" },
      { key: "period_credit", label: "Credit", type: "currency", width: 14, align: "right" },
      { key: "closing_balance", label: "Closing", type: "currency", width: 14, align: "right" },
    ],
  },
  {
    code: "FN-GL-001",
    title: "General Ledger Detail",
    description: "Posted journal lines for a period, optionally filtered to a single account.",
    moduleKey: "finance", group: "Ledger", standard: "IAS 1",
    hookId: "finance.generalLedgerDetail",
    parameters: [
      { key: "period", label: "Period", type: "dateRange", defaultDays: 30 },
      { key: "accountId", label: "Account ID (optional)", type: "text", placeholder: "uuid" },
    ],
    columns: [
      { key: "journal_date", label: "Date", type: "date", width: 12 },
      { key: "journal_number", label: "Journal #", type: "string", width: 16 },
      { key: "journal_type", label: "Type", type: "string", width: 12 },
      { key: "account_code", label: "Account", type: "string", width: 12 },
      { key: "account_name", label: "Account Name", type: "string", width: 30 },
      { key: "description", label: "Description", type: "string", width: 36 },
      { key: "reference_number", label: "Reference", type: "string", width: 18 },
      { key: "debit_amount", label: "Debit", type: "currency", width: 14, align: "right" },
      { key: "credit_amount", label: "Credit", type: "currency", width: 14, align: "right" },
      { key: "cost_center", label: "Cost Center", type: "string", width: 18 },
    ],
  },
  {
    code: "FN-AP-AGE-001",
    title: "Accounts Payable Aging",
    description: "Open supplier invoices bucketed 0-30 / 31-60 / 61-90 / 90+ days overdue.",
    moduleKey: "finance", group: "Aging", standard: "IFRS 9",
    hookId: "finance.apAging",
    parameters: [{ key: "asOfDate", label: "As of date", type: "date" }],
    columns: [
      { key: "invoice_number", label: "Invoice #", type: "string", width: 16 },
      { key: "supplier_name", label: "Supplier", type: "string", width: 28 },
      { key: "invoice_date", label: "Inv Date", type: "date", width: 12 },
      { key: "due_date", label: "Due Date", type: "date", width: 12 },
      { key: "net_amount", label: "Net", type: "currency", width: 14, align: "right" },
      { key: "amount_paid", label: "Paid", type: "currency", width: 14, align: "right" },
      { key: "outstanding", label: "Outstanding", type: "currency", width: 14, align: "right" },
      { key: "days_overdue", label: "Days OD", type: "integer", width: 10, align: "right" },
      { key: "bucket", label: "Bucket", type: "string", width: 10 },
      { key: "bucket_0_30", label: "0-30", type: "currency", width: 12, align: "right" },
      { key: "bucket_31_60", label: "31-60", type: "currency", width: 12, align: "right" },
      { key: "bucket_61_90", label: "61-90", type: "currency", width: 12, align: "right" },
      { key: "bucket_90_plus", label: "90+", type: "currency", width: 12, align: "right" },
      { key: "currency", label: "Cur", type: "string", width: 8 },
    ],
  },
  {
    code: "FN-AR-AGE-001",
    title: "Accounts Receivable Aging",
    description: "Open customer invoices bucketed 0-30 / 31-60 / 61-90 / 90+ days overdue.",
    moduleKey: "finance", group: "Aging", standard: "IFRS 9 / IFRS 15",
    hookId: "finance.arAging",
    parameters: [{ key: "asOfDate", label: "As of date", type: "date" }],
    columns: [
      { key: "invoice_number", label: "Invoice #", type: "string", width: 16 },
      { key: "customer_name", label: "Customer", type: "string", width: 28 },
      { key: "invoice_date", label: "Inv Date", type: "date", width: 12 },
      { key: "due_date", label: "Due Date", type: "date", width: 12 },
      { key: "net_amount", label: "Net", type: "currency", width: 14, align: "right" },
      { key: "amount_received", label: "Received", type: "currency", width: 14, align: "right" },
      { key: "outstanding", label: "Outstanding", type: "currency", width: 14, align: "right" },
      { key: "days_overdue", label: "Days OD", type: "integer", width: 10, align: "right" },
      { key: "bucket", label: "Bucket", type: "string", width: 10 },
      { key: "bucket_0_30", label: "0-30", type: "currency", width: 12, align: "right" },
      { key: "bucket_31_60", label: "31-60", type: "currency", width: 12, align: "right" },
      { key: "bucket_61_90", label: "61-90", type: "currency", width: 12, align: "right" },
      { key: "bucket_90_plus", label: "90+", type: "currency", width: 12, align: "right" },
      { key: "currency", label: "Cur", type: "string", width: 8 },
    ],
  },
  {
    code: "FN-FA-REG-001",
    title: "Fixed Asset Register & Depreciation",
    description: "Acquisition cost, depreciation method, accumulated depreciation, and net book value.",
    moduleKey: "finance", group: "Assets", standard: "IAS 16",
    hookId: "finance.fixedAssetRegister",
    parameters: [{ key: "asOfDate", label: "As of date", type: "date" }],
    columns: [
      { key: "asset_id", label: "Asset ID", type: "string", width: 14 },
      { key: "name", label: "Name", type: "string", width: 28 },
      { key: "category", label: "Category", type: "string", width: 18 },
      { key: "serial_number", label: "Serial #", type: "string", width: 16 },
      { key: "asset_tag", label: "Tag", type: "string", width: 12 },
      { key: "purchase_date", label: "Purchase Date", type: "date", width: 14 },
      { key: "purchase_price", label: "Cost", type: "currency", width: 14, align: "right" },
      { key: "depreciation_method", label: "Method", type: "string", width: 12 },
      { key: "depreciation_rate", label: "Rate %", type: "percent", width: 10, align: "right" },
      { key: "useful_life_years", label: "Life", type: "integer", width: 8, align: "right" },
      { key: "salvage_value", label: "Salvage", type: "currency", width: 12, align: "right" },
      { key: "accumulated_depreciation", label: "Accum Dep.", type: "currency", width: 14, align: "right" },
      { key: "net_book_value", label: "NBV", type: "currency", width: 14, align: "right" },
      { key: "status", label: "Status", type: "string", width: 12 },
      { key: "location_name", label: "Location", type: "string", width: 18 },
    ],
  },
  {
    code: "FN-CF-001",
    title: "Cash & Bank Statement",
    description: "Bank account transactions for a period with running balance and reconciliation flag.",
    moduleKey: "finance", group: "Cash", standard: "IAS 7",
    hookId: "finance.cashBankStatement",
    parameters: [{ key: "period", label: "Period", type: "dateRange", defaultDays: 30 }],
    columns: [
      { key: "transaction_date", label: "Date", type: "date", width: 12 },
      { key: "bank_name", label: "Bank", type: "string", width: 18 },
      { key: "account_name", label: "Account", type: "string", width: 22 },
      { key: "transaction_type", label: "Type", type: "string", width: 14 },
      { key: "reference_number", label: "Reference", type: "string", width: 18 },
      { key: "description", label: "Description", type: "string", width: 36 },
      { key: "debit_amount", label: "Debit", type: "currency", width: 14, align: "right" },
      { key: "credit_amount", label: "Credit", type: "currency", width: 14, align: "right" },
      { key: "running_balance", label: "Balance", type: "currency", width: 14, align: "right" },
      { key: "is_reconciled", label: "Reconciled", type: "string", width: 10 },
      { key: "currency", label: "Cur", type: "string", width: 8 },
    ],
  },

  // ============================================================
  // PROCUREMENT
  // ============================================================
  {
    code: "PR-PR-REG-001",
    title: "Purchase Requisition Register",
    description: "All PRs raised within a period with status, priority, and total estimated value.",
    moduleKey: "procurement", group: "Orders", standard: "ISO 9001 §7.4",
    hookId: "procurement.prRegister",
    parameters: [{ key: "period", label: "Period", type: "dateRange", defaultDays: 30 }],
    columns: [
      { key: "pr_number", label: "PR #", type: "string", width: 16 },
      { key: "title", label: "Title", type: "string", width: 32 },
      { key: "requested_date", label: "Requested", type: "date", width: 12 },
      { key: "required_date", label: "Required", type: "date", width: 12 },
      { key: "department", label: "Department", type: "string", width: 18 },
      { key: "priority", label: "Priority", type: "string", width: 10 },
      { key: "status", label: "Status", type: "string", width: 16 },
      { key: "total_estimated_amount", label: "Est. Value", type: "currency", width: 14, align: "right" },
      { key: "line_count", label: "Lines", type: "integer", width: 8, align: "right" },
      { key: "approved_date", label: "Approved", type: "datetime", width: 22 },
    ],
  },
  {
    code: "PR-PO-REG-001",
    title: "Purchase Order Register",
    description: "All POs within a period with supplier, status, and final amount.",
    moduleKey: "procurement", group: "Orders", standard: "WCO trade docs",
    hookId: "procurement.poRegister",
    parameters: [{ key: "period", label: "Period", type: "dateRange", defaultDays: 30 }],
    columns: [
      { key: "po_number", label: "PO #", type: "string", width: 16 },
      { key: "po_date", label: "PO Date", type: "date", width: 12 },
      { key: "supplier_name", label: "Supplier", type: "string", width: 28 },
      { key: "status", label: "Status", type: "string", width: 14 },
      { key: "expected_delivery_date", label: "ETA", type: "date", width: 12 },
      { key: "actual_delivery_date", label: "Delivered", type: "date", width: 12 },
      { key: "final_amount", label: "Final Amount", type: "currency", width: 14, align: "right" },
      { key: "currency", label: "Cur", type: "string", width: 8 },
      { key: "line_count", label: "Lines", type: "integer", width: 8, align: "right" },
      { key: "approved_date", label: "Approved", type: "datetime", width: 22 },
    ],
  },
  {
    code: "PR-PO-OPN-001",
    title: "Open POs / Outstanding Commitments",
    description: "Active POs with quantity pending and outstanding committed value.",
    moduleKey: "procurement", group: "Orders", standard: "IAS 37",
    hookId: "procurement.openPo",
    parameters: [],
    columns: [
      { key: "po_number", label: "PO #", type: "string", width: 16 },
      { key: "po_date", label: "PO Date", type: "date", width: 12 },
      { key: "supplier_name", label: "Supplier", type: "string", width: 28 },
      { key: "status", label: "Status", type: "string", width: 14 },
      { key: "expected_delivery_date", label: "ETA", type: "date", width: 12 },
      { key: "total_qty_ordered", label: "Ordered", type: "number", width: 12, align: "right" },
      { key: "total_qty_received", label: "Received", type: "number", width: 12, align: "right" },
      { key: "total_qty_pending", label: "Pending", type: "number", width: 12, align: "right" },
      { key: "outstanding_value", label: "Outstanding", type: "currency", width: 14, align: "right" },
      { key: "currency", label: "Cur", type: "string", width: 8 },
      { key: "days_open", label: "Days Open", type: "integer", width: 10, align: "right" },
    ],
  },
  {
    code: "PR-3WM-001",
    title: "Three-Way Match Exceptions",
    description: "Supplier invoices that have not passed automatic three-way matching.",
    moduleKey: "procurement", group: "Compliance", standard: "SOX ITGC",
    hookId: "procurement.threeWayMatchExceptions",
    parameters: [{ key: "period", label: "Period", type: "dateRange", defaultDays: 90 }],
    columns: [
      { key: "invoice_number", label: "Invoice #", type: "string", width: 16 },
      { key: "invoice_date", label: "Inv Date", type: "date", width: 12 },
      { key: "supplier_name", label: "Supplier", type: "string", width: 26 },
      { key: "po_number", label: "PO #", type: "string", width: 16 },
      { key: "grn_number", label: "GRN #", type: "string", width: 16 },
      { key: "three_way_match_status", label: "Match Status", type: "string", width: 18 },
      { key: "invoice_amount", label: "Amount", type: "currency", width: 14, align: "right" },
      { key: "status", label: "Inv Status", type: "string", width: 14 },
      { key: "currency", label: "Cur", type: "string", width: 8 },
    ],
  },
  {
    code: "PR-SPND-001",
    title: "Spend Analysis (by supplier × month)",
    description: "Procurement spend rolled up by supplier and calendar month.",
    moduleKey: "procurement", group: "Spend", standard: "CIPS spend cube",
    hookId: "procurement.spendAnalysis",
    parameters: [{ key: "period", label: "Period", type: "dateRange", defaultDays: 365 }],
    columns: [
      { key: "period_month", label: "Month", type: "string", width: 12 },
      { key: "supplier_name", label: "Supplier", type: "string", width: 30 },
      { key: "po_count", label: "POs", type: "integer", width: 8, align: "right" },
      { key: "total_qty", label: "Total Qty", type: "number", width: 14, align: "right" },
      { key: "total_spend", label: "Total Spend", type: "currency", width: 16, align: "right" },
      { key: "currency", label: "Cur", type: "string", width: 8 },
    ],
  },

  // ============================================================
  // SOURCING
  // ============================================================
  {
    code: "SR-RFQ-REG-001",
    title: "RFQ / RFP Register",
    description: "Sourcing events within a period with invited supplier and quote counts.",
    moduleKey: "sourcing", group: "Sourcing", standard: "ISO 9001 §8.4",
    hookId: "sourcing.rfqRegister",
    parameters: [{ key: "period", label: "Period", type: "dateRange", defaultDays: 90 }],
    columns: [
      { key: "request_number", label: "RFQ/RFP #", type: "string", width: 18 },
      { key: "request_type", label: "Type", type: "string", width: 10 },
      { key: "title", label: "Title", type: "string", width: 32 },
      { key: "category", label: "Category", type: "string", width: 18 },
      { key: "status", label: "Status", type: "string", width: 14 },
      { key: "priority", label: "Priority", type: "string", width: 10 },
      { key: "issue_date", label: "Issued", type: "date", width: 12 },
      { key: "submission_deadline", label: "Submission Due", type: "date", width: 14 },
      { key: "evaluation_deadline", label: "Eval Due", type: "date", width: 12 },
      { key: "budget_estimate", label: "Budget", type: "currency", width: 14, align: "right" },
      { key: "currency", label: "Cur", type: "string", width: 8 },
      { key: "invited_count", label: "Invited", type: "integer", width: 8, align: "right" },
      { key: "quote_count", label: "Quotes", type: "integer", width: 8, align: "right" },
    ],
  },
  {
    code: "SR-QUOTE-CMP-001",
    title: "Quotation Comparison",
    description: "Side-by-side supplier quotes for a single RFQ ordered by evaluation score.",
    moduleKey: "sourcing", group: "Sourcing", standard: "CIPS evaluation",
    hookId: "sourcing.quoteComparison",
    parameters: [{ key: "requestId", label: "RFQ Request ID", type: "text", placeholder: "uuid" }],
    columns: [
      { key: "request_number", label: "RFQ #", type: "string", width: 18 },
      { key: "request_title", label: "RFQ Title", type: "string", width: 28 },
      { key: "supplier_name", label: "Supplier", type: "string", width: 26 },
      { key: "quote_number", label: "Quote #", type: "string", width: 16 },
      { key: "submission_date", label: "Submitted", type: "datetime", width: 22 },
      { key: "status", label: "Status", type: "string", width: 12 },
      { key: "total_quoted_amount", label: "Quoted", type: "currency", width: 14, align: "right" },
      { key: "currency", label: "Cur", type: "string", width: 8 },
      { key: "validity_period", label: "Valid (days)", type: "integer", width: 10, align: "right" },
      { key: "payment_terms", label: "Payment Terms", type: "string", width: 18 },
      { key: "delivery_commitment", label: "Delivery", type: "string", width: 20 },
      { key: "evaluation_score", label: "Score", type: "number", width: 10, align: "right" },
    ],
  },
  {
    code: "SR-SUP-SCORE-001",
    title: "Supplier Scorecard",
    description: "Per-supplier rating, spend, on-time delivery %, evaluation score, and open actions.",
    moduleKey: "sourcing", group: "Sourcing", standard: "ISO 9001 §8.4.2",
    hookId: "sourcing.supplierScorecard",
    parameters: [{ key: "period", label: "Period", type: "dateRange", defaultDays: 365 }],
    columns: [
      { key: "supplier_code", label: "Code", type: "string", width: 14 },
      { key: "supplier_name", label: "Supplier", type: "string", width: 30 },
      { key: "category", label: "Category", type: "string", width: 18 },
      { key: "rating", label: "Rating", type: "number", width: 10, align: "right" },
      { key: "total_pos", label: "POs", type: "integer", width: 8, align: "right" },
      { key: "total_spend", label: "Spend", type: "currency", width: 16, align: "right" },
      { key: "on_time_delivery_pct", label: "OTD %", type: "percent", width: 10, align: "right" },
      { key: "avg_evaluation_score", label: "Eval Score", type: "number", width: 12, align: "right" },
      { key: "open_action_items", label: "Open Actions", type: "integer", width: 12, align: "right" },
      { key: "status", label: "Status", type: "string", width: 12 },
    ],
  },
  {
    code: "SR-CTR-EXP-001",
    title: "Contract Expiry & Renewal Pipeline",
    description: "Contracts expiring within the chosen horizon with auto-renew flag and counterparty.",
    moduleKey: "sourcing", group: "Contracts", standard: "ISO 9001 §7.5",
    hookId: "sourcing.contractExpiry",
    parameters: [
      {
        key: "horizon",
        label: "Horizon",
        type: "select",
        options: [
          { value: "30", label: "30 days" },
          { value: "60", label: "60 days" },
          { value: "90", label: "90 days" },
          { value: "180", label: "180 days" },
          { value: "365", label: "365 days" },
        ],
        defaultValue: "180",
      },
    ],
    columns: [
      { key: "contract_number", label: "Contract #", type: "string", width: 18 },
      { key: "contract_title", label: "Title", type: "string", width: 30 },
      { key: "contract_type", label: "Type", type: "string", width: 14 },
      { key: "status", label: "Status", type: "string", width: 12 },
      { key: "counterparty_name", label: "Counterparty", type: "string", width: 28 },
      { key: "contract_value", label: "Value", type: "currency", width: 14, align: "right" },
      { key: "currency", label: "Cur", type: "string", width: 8 },
      { key: "effective_date", label: "Effective", type: "date", width: 12 },
      { key: "expiry_date", label: "Expiry", type: "date", width: 12 },
      { key: "days_to_expiry", label: "Days Left", type: "integer", width: 10, align: "right" },
      { key: "auto_renew", label: "Auto-Renew", type: "string", width: 10 },
      { key: "renewal_count", label: "Renewals", type: "integer", width: 10, align: "right" },
    ],
  },

  // ============================================================
  // PRODUCTION
  // ============================================================
  {
    code: "PD-WIP-001",
    title: "Work-In-Progress by Stage",
    description: "Active production stages with input/output quantities, WIP balance, and stage cost.",
    moduleKey: "production", group: "WIP", standard: "IAS 2",
    hookId: "production.wip",
    parameters: [],
    columns: [
      { key: "order_number", label: "Order #", type: "string", width: 16 },
      { key: "product_name", label: "Product", type: "string", width: 26 },
      { key: "style_no", label: "Style", type: "string", width: 14 },
      { key: "target_qty", label: "Target", type: "number", width: 10, align: "right" },
      { key: "stage_name", label: "Stage", type: "string", width: 18 },
      { key: "sequence_order", label: "Seq", type: "integer", width: 6, align: "right" },
      { key: "stage_status", label: "Status", type: "string", width: 12 },
      { key: "input_qty", label: "Input", type: "number", width: 10, align: "right" },
      { key: "output_qty", label: "Output", type: "number", width: 10, align: "right" },
      { key: "wastage_qty", label: "Wastage", type: "number", width: 10, align: "right" },
      { key: "wip_qty", label: "WIP", type: "number", width: 10, align: "right" },
      { key: "stage_cost", label: "Stage Cost", type: "currency", width: 14, align: "right" },
      { key: "started_at", label: "Started", type: "datetime", width: 22 },
      { key: "completed_at", label: "Completed", type: "datetime", width: 22 },
    ],
  },
  {
    code: "PD-DAILY-001",
    title: "Daily Production Output",
    description: "Daily entries per stage with input/output, wastage, and efficiency %.",
    moduleKey: "production", group: "Output", standard: "ISO 22400",
    hookId: "production.dailyOutput",
    parameters: [{ key: "period", label: "Period", type: "dateRange", defaultDays: 30 }],
    columns: [
      { key: "entry_date", label: "Date", type: "date", width: 12 },
      { key: "order_number", label: "Order #", type: "string", width: 16 },
      { key: "product_name", label: "Product", type: "string", width: 26 },
      { key: "stage_name", label: "Stage", type: "string", width: 18 },
      { key: "input_qty", label: "Input", type: "number", width: 10, align: "right" },
      { key: "output_qty", label: "Output", type: "number", width: 10, align: "right" },
      { key: "wastage_qty", label: "Wastage", type: "number", width: 10, align: "right" },
      { key: "efficiency_pct", label: "Efficiency %", type: "percent", width: 12, align: "right" },
      { key: "notes", label: "Notes", type: "string", width: 30 },
    ],
  },
  {
    code: "PD-STG-COST-001",
    title: "Stage-wise Cost Breakdown",
    description: "Per-stage material and overhead costs for a production order.",
    moduleKey: "production", group: "Cost", standard: "IAS 2 §10",
    hookId: "production.stageCost",
    parameters: [{ key: "orderId", label: "Order ID (optional)", type: "text", placeholder: "uuid" }],
    columns: [
      { key: "order_number", label: "Order #", type: "string", width: 16 },
      { key: "product_name", label: "Product", type: "string", width: 24 },
      { key: "stage_name", label: "Stage", type: "string", width: 18 },
      { key: "sequence_order", label: "Seq", type: "integer", width: 6, align: "right" },
      { key: "item_name", label: "Item", type: "string", width: 26 },
      { key: "source", label: "Source", type: "string", width: 14 },
      { key: "unit_of_measure", label: "UoM", type: "string", width: 8 },
      { key: "quantity_used", label: "Qty Used", type: "number", width: 12, align: "right" },
      { key: "unit_cost", label: "Unit Cost", type: "currency", width: 14, align: "right" },
      { key: "total_cost", label: "Total Cost", type: "currency", width: 14, align: "right" },
    ],
  },
  {
    code: "PD-EFF-001",
    title: "Production Efficiency / OEE",
    description: "Per-order yield, wastage, and completion percentages aggregated across all stages.",
    moduleKey: "production", group: "Output", standard: "ISO 22400-2",
    hookId: "production.efficiency",
    parameters: [{ key: "period", label: "Order Start Range", type: "dateRange", defaultDays: 90 }],
    columns: [
      { key: "order_number", label: "Order #", type: "string", width: 16 },
      { key: "product_name", label: "Product", type: "string", width: 26 },
      { key: "target_qty", label: "Target", type: "number", width: 10, align: "right" },
      { key: "total_input", label: "Total Input", type: "number", width: 12, align: "right" },
      { key: "total_output", label: "Total Output", type: "number", width: 12, align: "right" },
      { key: "total_wastage", label: "Wastage", type: "number", width: 12, align: "right" },
      { key: "yield_pct", label: "Yield %", type: "percent", width: 10, align: "right" },
      { key: "wastage_pct", label: "Wastage %", type: "percent", width: 10, align: "right" },
      { key: "completion_pct", label: "Completion %", type: "percent", width: 12, align: "right" },
      { key: "status", label: "Status", type: "string", width: 12 },
      { key: "start_date", label: "Start", type: "date", width: 12 },
      { key: "due_date", label: "Due", type: "date", width: 12 },
    ],
  },

  // ============================================================
  // CONSTRUCTION
  // ============================================================
  {
    code: "CN-DSR-001",
    title: "Daily Site Report Summary",
    description: "DSRs in a period with labour counts, weather, and attendance roll-up.",
    moduleKey: "construction", group: "Site", standard: "ISO 19650",
    hookId: "construction.dsrSummary",
    parameters: [{ key: "period", label: "Period", type: "dateRange", defaultDays: 30 }],
    columns: [
      { key: "report_number", label: "DSR #", type: "string", width: 16 },
      { key: "report_date", label: "Date", type: "date", width: 12 },
      { key: "project_code", label: "Project", type: "string", width: 14 },
      { key: "project_name", label: "Project Name", type: "string", width: 28 },
      { key: "weather_conditions", label: "Weather", type: "string", width: 16 },
      { key: "temperature_high", label: "Temp High", type: "number", width: 10, align: "right" },
      { key: "temperature_low", label: "Temp Low", type: "number", width: 10, align: "right" },
      { key: "labor_count", label: "Labour", type: "integer", width: 8, align: "right" },
      { key: "skilled_labor_count", label: "Skilled", type: "integer", width: 8, align: "right" },
      { key: "unskilled_labor_count", label: "Unskilled", type: "integer", width: 8, align: "right" },
      { key: "subcontractor_count", label: "Subc.", type: "integer", width: 8, align: "right" },
      { key: "visitor_count", label: "Visitors", type: "integer", width: 8, align: "right" },
      { key: "attendance_present", label: "Present", type: "integer", width: 10, align: "right" },
      { key: "attendance_absent", label: "Absent", type: "integer", width: 10, align: "right" },
      { key: "status", label: "Status", type: "string", width: 12 },
    ],
  },
  {
    code: "CN-PROG-001",
    title: "Project Progress vs Plan",
    description: "Per-project completion %, days elapsed, and schedule variance %.",
    moduleKey: "construction", group: "Progress", standard: "PMI EVM",
    hookId: "construction.progress",
    parameters: [],
    columns: [
      { key: "project_code", label: "Project", type: "string", width: 14 },
      { key: "project_name", label: "Name", type: "string", width: 30 },
      { key: "status", label: "Status", type: "string", width: 14 },
      { key: "start_date", label: "Start", type: "date", width: 12 },
      { key: "target_end_date", label: "Target End", type: "date", width: 12 },
      { key: "actual_end_date", label: "Actual End", type: "date", width: 12 },
      { key: "estimated_budget", label: "Budget", type: "currency", width: 14, align: "right" },
      { key: "actual_cost", label: "Actual Cost", type: "currency", width: 14, align: "right" },
      { key: "completion_percentage", label: "Complete %", type: "percent", width: 12, align: "right" },
      { key: "days_elapsed", label: "Days Elapsed", type: "integer", width: 12, align: "right" },
      { key: "days_total", label: "Days Total", type: "integer", width: 10, align: "right" },
      { key: "schedule_variance_pct", label: "Sched Var %", type: "percent", width: 12, align: "right" },
    ],
  },
  {
    code: "CN-BUD-VAR-001",
    title: "Project Budget vs Actual Variance",
    description: "Per budget line: planned vs committed vs actual with variance amount and %.",
    moduleKey: "construction", group: "Budget", standard: "PMI EVM",
    hookId: "construction.budgetVariance",
    parameters: [{ key: "projectId", label: "Project ID (optional)", type: "text", placeholder: "uuid" }],
    columns: [
      { key: "project_code", label: "Project", type: "string", width: 14 },
      { key: "project_name", label: "Name", type: "string", width: 24 },
      { key: "budget_code", label: "Code", type: "string", width: 14 },
      { key: "category", label: "Category", type: "string", width: 18 },
      { key: "description", label: "Description", type: "string", width: 28 },
      { key: "unit", label: "Unit", type: "string", width: 8 },
      { key: "quantity", label: "Qty", type: "number", width: 10, align: "right" },
      { key: "unit_cost", label: "Unit Cost", type: "currency", width: 14, align: "right" },
      { key: "planned_amount", label: "Planned", type: "currency", width: 14, align: "right" },
      { key: "committed_amount", label: "Committed", type: "currency", width: 14, align: "right" },
      { key: "actual_amount", label: "Actual", type: "currency", width: 14, align: "right" },
      { key: "variance_amount", label: "Variance", type: "currency", width: 14, align: "right" },
      { key: "variance_pct", label: "Variance %", type: "percent", width: 12, align: "right" },
    ],
  },
  {
    code: "CN-MAT-MOV-001",
    title: "Material Movements (Construction)",
    description: "Construction inventory transactions with item, quantity change, and location.",
    moduleKey: "construction", group: "Materials", standard: "ISO 9001 §8.5",
    hookId: "construction.materialMovements",
    parameters: [{ key: "period", label: "Period", type: "dateRange", defaultDays: 30 }],
    columns: [
      { key: "transaction_date", label: "Date", type: "date", width: 12 },
      { key: "transaction_type", label: "Type", type: "string", width: 14 },
      { key: "item_code", label: "Item Code", type: "string", width: 16 },
      { key: "item_name", label: "Item Name", type: "string", width: 28 },
      { key: "quantity_change", label: "Qty Δ", type: "number", width: 12, align: "right" },
      { key: "location_name", label: "Location", type: "string", width: 18 },
      { key: "notes", label: "Notes", type: "string", width: 30 },
    ],
  },

  // ============================================================
  // MANAGEMENT
  // ============================================================
  {
    code: "MG-APR-PEND-001",
    title: "Pending Approvals Aging",
    description: "All documents awaiting approval across modules with days pending.",
    moduleKey: "management", group: "Approvals", standard: "SOX DoA",
    hookId: "management.pendingApprovals",
    parameters: [],
    columns: [
      { key: "module", label: "Module", type: "string", width: 14 },
      { key: "document_type", label: "Type", type: "string", width: 10 },
      { key: "document_number", label: "Document #", type: "string", width: 18 },
      { key: "title", label: "Title", type: "string", width: 30 },
      { key: "submitted_date", label: "Submitted", type: "datetime", width: 22 },
      { key: "days_pending", label: "Days Pending", type: "integer", width: 12, align: "right" },
      { key: "current_status", label: "Status", type: "string", width: 16 },
      { key: "amount", label: "Amount", type: "currency", width: 14, align: "right" },
      { key: "currency", label: "Cur", type: "string", width: 8 },
    ],
  },
  {
    code: "MG-AUD-LOG-001",
    title: "System Audit Log",
    description: "Cross-module audit events filterable by module, user, and period.",
    moduleKey: "management", group: "Audit", standard: "ISO 27001 A.12.4",
    hookId: "management.systemAuditLog",
    parameters: [
      { key: "period", label: "Period", type: "dateRange", defaultDays: 30 },
      { key: "module", label: "Module (optional)", type: "text", placeholder: "warehouse" },
    ],
    columns: [
      { key: "event_time", label: "Time", type: "datetime", width: 22 },
      { key: "module", label: "Module", type: "string", width: 14 },
      { key: "event_type", label: "Event", type: "string", width: 16 },
      { key: "reference", label: "Reference", type: "string", width: 18 },
      { key: "details", label: "Details", type: "string", width: 40 },
      { key: "user_id", label: "User ID", type: "string", width: 36 },
    ],
  },
  {
    code: "MG-RPT-USE-001",
    title: "Report Usage / Export Audit",
    description: "Every report exported by every user (SOX evidence pack).",
    moduleKey: "management", group: "Audit", standard: "SOX evidence pack",
    hookId: "management.reportUsage",
    parameters: [{ key: "period", label: "Period", type: "dateRange", defaultDays: 30 }],
    columns: [
      { key: "generated_at", label: "Generated", type: "datetime", width: 22 },
      { key: "report_code", label: "Report", type: "string", width: 18 },
      { key: "report_title", label: "Title", type: "string", width: 32 },
      { key: "module_key", label: "Module", type: "string", width: 14 },
      { key: "format", label: "Format", type: "string", width: 10 },
      { key: "row_count", label: "Rows", type: "integer", width: 8, align: "right" },
      { key: "generated_by", label: "User ID", type: "string", width: 36 },
      { key: "user_agent", label: "Agent", type: "string", width: 30 },
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
