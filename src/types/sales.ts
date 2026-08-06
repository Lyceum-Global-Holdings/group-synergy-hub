// Sales suite types: services catalog, quotations, invoice line items.

export type QuotationStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'invoiced';

export interface Service {
  id: string;
  service_code: string;
  name: string;
  description: string | null;
  category: string | null;
  unit: string;
  default_price: number;
  is_active: boolean;
  template_id: string | null;
  company_id: string | null; // null = generic template
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ServicePriceHistory {
  id: string;
  service_id: string;
  old_price: number | null;
  new_price: number;
  changed_by: string | null;
  created_at: string;
}

export interface QuotationItem {
  id: string;
  quotation_id: string;
  service_id: string | null;
  item_name: string;
  description: string | null;
  unit: string;
  quantity: number;
  unit_price: number;
  list_price: number | null;
  line_total: number;
  sort_order: number;
  created_at: string;
}

export interface Quotation {
  id: string;
  quote_number: string;
  customer_id: string | null;
  quote_date: string;
  valid_until: string | null;
  status: QuotationStatus;
  subtotal: number;
  discount_type: 'percent' | 'fixed' | null;
  discount_value: number;
  discount_amount: number;
  tax_type: 'percent' | 'fixed' | null;
  tax_value: number;
  tax_amount: number;
  total_amount: number;
  payment_terms: string | null;
  notes: string | null;
  terms: string | null;
  invoice_id: string | null;
  sent_at: string | null;
  decided_at: string | null;
  company_id: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  customer?: { id: string; customer_name: string; customer_code: string } | null;
  items?: QuotationItem[];
}

export interface QuotationItemInput {
  service_id?: string | null;
  item_name: string;
  description?: string | null;
  unit: string;
  quantity: number;
  unit_price: number;
  list_price?: number | null;
  sort_order?: number;
}

export interface CreateQuotationData {
  customer_id: string | null;
  quote_date: string;
  valid_until?: string | null;
  discount_type?: 'percent' | 'fixed' | null;
  discount_value?: number;
  tax_type?: 'percent' | 'fixed' | null;
  tax_value?: number;
  payment_terms?: string | null;
  notes?: string | null;
  terms?: string | null;
  company_id: string;
  items: QuotationItemInput[];
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  service_id: string | null;
  item_name: string;
  description: string | null;
  unit: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  sort_order: number;
}

export const QUOTATION_STATUS_META: Record<QuotationStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft:    { label: 'Draft',    variant: 'secondary' },
  sent:     { label: 'Sent',     variant: 'outline' },
  accepted: { label: 'Accepted', variant: 'default' },
  rejected: { label: 'Rejected', variant: 'destructive' },
  expired:  { label: 'Expired',  variant: 'destructive' },
  invoiced: { label: 'Invoiced', variant: 'default' },
};

export const SERVICE_UNITS = ['job', 'hour', 'day', 'visit', 'trip', 'unit', 'month'] as const;
