export type RowStatus = 'pending' | 'valid' | 'invalid' | 'imported' | 'error';

export interface BulkCatalogSplit {
  splitId: string;
  bin_id: string | null;
  qty: string;
  unit_cost: string;
  status: RowStatus;
  message: string | null;
}

export interface BulkCatalogRow {
  rowId: string; // local uuid
  catalog_item_id: string | null;
  item_code: string;
  name: string;
  uom: string | null;
  company_id: string | null;
  location_id: string | null;
  bin_id: string | null;
  opening_qty: string; // keep as string for editing
  unit_cost: string;
  reorder_level: string;
  reference_no: string;
  notes: string;
  status: RowStatus;
  message: string | null;
  /**
   * Optional multi-bin split. When non-empty, the parent's bin/opening_qty
   * fields are ignored and one allocation per split is sent to the RPC.
   * Standard WMS putaway-split (SAP EWM / Oracle WMS) pattern.
   */
  splits?: BulkCatalogSplit[];
}

export interface ImportResultRow {
  row: number;
  status: 'imported' | 'provisioned' | 'error';
  catalog_item_id?: string;
  warehouse_item_id?: string;
  error?: string;
}

export interface PasteEntry {
  code: string;
  opening_qty?: number | null;
  unit_cost?: number | null;
  reorder_level?: number | null;
  notes?: string | null;
  bin_code?: string | null;
}

export function newSplit(partial: Partial<BulkCatalogSplit> = {}): BulkCatalogSplit {
  return {
    splitId: crypto.randomUUID(),
    bin_id: null,
    qty: '',
    unit_cost: '',
    status: 'pending',
    message: null,
    ...partial,
  };
}

export function newRow(partial: Partial<BulkCatalogRow> = {}): BulkCatalogRow {
  return {
    rowId: crypto.randomUUID(),
    catalog_item_id: null,
    item_code: '',
    name: '',
    uom: null,
    company_id: null,
    location_id: null,
    bin_id: null,
    opening_qty: '',
    unit_cost: '',
    reorder_level: '',
    reference_no: '',
    notes: '',
    status: 'pending',
    message: null,
    ...partial,
  };
}
