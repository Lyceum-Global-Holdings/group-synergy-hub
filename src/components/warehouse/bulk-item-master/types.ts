export type BulkItemRowStatus = 'pending' | 'valid' | 'invalid' | 'imported' | 'error';

export interface BulkItemMasterRow {
  rowId: string;
  name: string;
  description: string;
  brand: string;
  category_id: string | null;
  unit_id: string | null;
  /** Current item code in the cell (auto or user-edited). */
  item_code: string;
  /** Last auto-generated suggestion for the current category. */
  auto_item_code: string;
  /** True when the user has manually edited the code (locks against auto re-fill). */
  code_manual: boolean;
  /** Classifier confidence for the suggested category/UoM. */
  classify_confidence: 'high' | 'low' | 'none';
  /** Suggested UNSPSC family name when no tenant category matched. */
  suggested_family: string | null;
  status: BulkItemRowStatus;
  errors: string[];
  warnings: string[];
}
