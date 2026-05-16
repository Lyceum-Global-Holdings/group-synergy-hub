export type PartialPieceStatus = "available" | "reserved" | "consumed" | "scrapped";

export interface PartialPieceRow extends Record<string, unknown> {
  id: string;
  piece_code: string;
  parent_item_id: string;
  parent_item_code: string;
  parent_item_name: string;
  base_uom: string | null;
  secondary_uom?: string | null;
  track_secondary_quantity?: boolean | null;
  parent_item_status?: string | null;
  size_value: number;
  size_uom: string;
  location_id: string;
  location_name: string;
  bin_id: string | null;
  bin_code: string | null;
  status: PartialPieceStatus;
  source_ref: string | null;
  batch_number: string | null;
  unit_cost: number | null;
  label: string | null;
  notes: string | null;
  age_days: number;
  created_at: string;
  updated_at: string;
}

export const CONSUME_REASONS = [
  { value: "consumption", label: "Consumption (used in work)" },
  { value: "production", label: "Production input" },
  { value: "sample", label: "Sample / testing" },
  { value: "scrap", label: "Scrap (write-off)" },
] as const;

export const PIECE_STATUS_OPTIONS: { value: PartialPieceStatus | "all"; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "available", label: "Available" },
  { value: "reserved", label: "Reserved" },
  { value: "consumed", label: "Consumed" },
  { value: "scrapped", label: "Scrapped" },
];
