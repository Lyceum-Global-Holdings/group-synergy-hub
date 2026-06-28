export type GrnStatus = 'draft' | 'submitted' | 'approved' | 'completed' | 'cancelled' | 'rejected';
export type QualityStatus = 'good' | 'damaged' | 'rejected';

export type GrnRejectionReason =
  | 'damaged_in_transit'
  | 'quantity_short'
  | 'quantity_over'
  | 'wrong_item'
  | 'quality_failure'
  | 'expired_or_near_expiry'
  | 'missing_documentation'
  | 'late_delivery'
  | 'packaging_non_conformance'
  | 'supplier_non_conformance'
  | 'other';

export const GRN_REJECTION_REASONS: { value: GrnRejectionReason; label: string; description: string }[] = [
  { value: 'damaged_in_transit', label: 'Damaged in transit', description: 'GS1 CBV: damaged' },
  { value: 'quantity_short', label: 'Short quantity received', description: 'ISO 9001 §8.7 / SAP MIGO short delivery' },
  { value: 'quantity_over', label: 'Over-delivered quantity', description: 'SAP MIGO over-delivery' },
  { value: 'wrong_item', label: 'Wrong item / spec mismatch', description: 'ISO 9001 nonconformity' },
  { value: 'quality_failure', label: 'Failed quality inspection', description: 'ISO 9001 §8.7' },
  { value: 'expired_or_near_expiry', label: 'Expired / shelf-life breach', description: 'GS1 CBV: expired' },
  { value: 'missing_documentation', label: 'Missing invoice / COA / packing list', description: 'INCOTERMS 2020 doc compliance' },
  { value: 'late_delivery', label: 'Outside agreed delivery window', description: 'OTIF KPI' },
  { value: 'packaging_non_conformance', label: 'Packaging non-conformance', description: 'GS1 packaging guidelines' },
  { value: 'supplier_non_conformance', label: 'Supplier non-conformance (other)', description: 'ISO 9001 §8.4' },
  { value: 'other', label: 'Other (notes required)', description: '' },
];

export const GRN_REJECTION_REASON_LABELS: Record<GrnRejectionReason, string> = GRN_REJECTION_REASONS.reduce(
  (acc, r) => {
    acc[r.value] = r.label;
    return acc;
  },
  {} as Record<GrnRejectionReason, string>,
);

export interface GoodsReceiptNote {
  id: string;
  grn_number: string;
  grn_date: string;
  po_id?: string;
  po_number?: string;
  supplier_id?: string;
  supplier_name?: string;
  supplier_address?: string;
  invoice_number?: string;
  invoice_date?: string;
  invoice_document_url?: string;
  status: GrnStatus;
  total_value: number;
  subtotal_value?: number;
  discount_type?: 'percent' | 'fixed' | null;
  discount_value?: number;
  discount_amount?: number;
  tax_type?: 'percent' | 'fixed' | null;
  tax_value?: number;
  tax_amount?: number;
  transport_cost?: number;
  grand_total?: number;
  remarks?: string;
  company_id?: string;
  location_id?: string;
  warehouse_locations?: { name: string } | null;
  created_by?: string;
  received_by?: string;
  approved_by?: string;
  approved_date?: string;
  created_at: string;
  updated_at: string;
  grn_items?: GrnItem[];
  purchase_order?: {
    po_number: string;
    supplier: {
      name: string;
    };
  };
  created_by_profile?: {
    full_name: string;
  };
  received_by_profile?: {
    full_name: string;
  };
  approved_by_profile?: {
    full_name: string;
  };
}

export interface GrnItem {
  id: string;
  grn_id: string;
  po_item_id?: string;
  warehouse_item_id?: string;
  item_code?: string;
  item_name: string;
  description?: string;
  unit_of_measure: string;
  quantity_ordered?: number;
  quantity_received: number;
  unit_price: number;
  total_cost: number;
  discount_type?: 'percent' | 'fixed' | null;
  discount_value?: number;
  line_discount_amount?: number;
  net_unit_price?: number;
  quality_status: QualityStatus;
  remarks?: string;
  created_at: string;
  warehouse_item?: {
    item_name: string;
    item_code?: string;
    unit_of_measure: string;
  };
  po_item?: {
    item_name: string;
    quantity: number;
    quantity_received?: number;
  };
}

export interface CreateGrnData {
  grn_date: string;
  po_id?: string;
  po_number?: string;
  supplier_id?: string;
  supplier_name?: string;
  supplier_address?: string;
  invoice_number?: string;
  invoice_date?: string;
  invoice_document_url?: string;
  status: GrnStatus;
  discount_type?: 'percent' | 'fixed' | null;
  discount_value?: number;
  tax_type?: 'percent' | 'fixed' | null;
  tax_value?: number;
  transport_cost?: number;
  remarks?: string;
  company_id?: string;
  location_id?: string | null;
  items: CreateGrnItemData[];
}

export interface CreateGrnItemData {
  po_item_id?: string;
  warehouse_item_id?: string;
  catalog_item_id?: string;
  item_code?: string;

  item_name: string;
  description?: string;
  unit_of_measure: string;
  quantity_ordered?: number;
  quantity_already_received?: number;
  quantity_pending_approval?: number;
  quantity_received: number;
  unit_price: number;
  total_cost: number;
  discount_type?: 'percent' | 'fixed' | null;
  discount_value?: number;
  line_discount_amount?: number;
  net_unit_price?: number;
  quality_status: QualityStatus;
  remarks?: string;
  // Batch tracking fields
  batch_number?: string;
  manufacturing_date?: string;
  expiry_date?: string;
  // Serial tracking fields
  serial_numbers?: string[];
  // Item tracking flags (from warehouse_items)
  is_batch_tracked?: boolean;
  is_serialized?: boolean;
  // Dual quantity tracking
  track_secondary_quantity?: boolean;
  secondary_uom?: string;
  secondary_quantity_received?: number;
  conversion_note?: string;
}

export interface GrnSummary {
  total_grns: number;
  pending_approval: number;
  approved_this_month: number;
  total_value: number;
}
