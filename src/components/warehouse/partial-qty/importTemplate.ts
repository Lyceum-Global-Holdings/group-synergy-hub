import { downloadCSV } from "@/lib/bulkImport/csvParser";

export const PARTIAL_IMPORT_COLUMNS = [
  "item_code",
  "location_code",
  "bin_code",
  "quantity",
  "secondary_quantity",
  "batch_number",
  "manufacture_date",
  "expiry_date",
  "unit_cost",
  "received_at",
  "reference",
  "notes",
  "mode",
] as const;

export type PartialImportColumn = (typeof PARTIAL_IMPORT_COLUMNS)[number];

export const REQUIRED_COLUMNS: PartialImportColumn[] = [
  "item_code",
  "location_code",
  "bin_code",
  "quantity",
];

export function downloadPartialQtyTemplate() {
  const sample = [
    [
      "ITM-0001",
      "WH-MAIN",
      "A-01-01",
      "10",
      "",
      "",
      "",
      "",
      "12.50",
      new Date().toISOString().slice(0, 10),
      "GRN-2025-001",
      "Initial seed",
      "add",
    ],
    [
      "ITM-0002",
      "WH-MAIN",
      "A-02-03",
      "100",
      "",
      "BATCH-A",
      "2025-01-01",
      "2027-01-01",
      "",
      "",
      "ASN-9912",
      "",
      "add",
    ],
  ];
  downloadCSV(
    "partial-quantities-template.csv",
    PARTIAL_IMPORT_COLUMNS as unknown as string[],
    sample,
  );
}
