import { downloadCSV } from "@/lib/bulkImport/csvParser";

export const PARTIAL_PIECE_COLUMNS = [
  "piece_code",
  "parent_item_code",
  "size_value",
  "quantity",
  "size_uom",
  "location_code",
  "bin_code",
  "source_ref",
  "batch_number",
  "unit_cost",
  "label",
  "notes",
] as const;

export type PartialPieceColumn = (typeof PARTIAL_PIECE_COLUMNS)[number];

export const REQUIRED_COLUMNS: PartialPieceColumn[] = [
  "parent_item_code",
  "size_value",
  "location_code",
];

export function downloadPartialPieceTemplate() {
  const sample = [
    ["", "WIRE-CU-2.5", "2.30", "1", "m", "WH-MAIN", "A-01-01", "GRN-2025-001", "", "1.20", "Reel-A offcut", "Leftover from cut"],
    ["", "WIRE-CU-2.5", "4.75", "3", "m", "WH-MAIN", "A-01-01", "GRN-2025-001", "", "1.20", "Reel-A offcut", ""],
    ["PQ-MANUAL-01", "STEEL-PLT-3", "0.85", "1", "m2", "WH-MAIN", "B-02-01", "Job-77", "B-2025-09", "45.00", "Plate offcut", ""],
  ];
  downloadCSV(
    "partial-pieces-template.csv",
    PARTIAL_PIECE_COLUMNS as unknown as string[],
    sample,
  );
}
