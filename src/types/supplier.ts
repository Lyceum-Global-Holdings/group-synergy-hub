export interface Supplier {
  id: string;
  supplier_code: string;
  name: string;
  legal_name?: string;
  supplier_type: 'vendor' | 'service_provider' | 'contractor' | 'manufacturer';
  category?: string;
  status: 'active' | 'inactive' | 'suspended' | 'blacklisted';
  email?: string;
  phone?: string;
  website?: string;
  tax_id?: string;
  registration_number?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  payment_terms?: string;
  credit_limit?: number;
  currency: string;
  rating?: number;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  contacts?: SupplierContact[];
}

export interface SupplierContact {
  id: string;
  supplier_id: string;
  name: string;
  title?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateSupplierData {
  name: string;
  legal_name?: string;
  supplier_type: 'vendor' | 'service_provider' | 'contractor' | 'manufacturer';
  category?: string;
  email?: string;
  phone?: string;
  website?: string;
  tax_id?: string;
  registration_number?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  payment_terms?: string;
  credit_limit?: number;
  currency?: string;
  rating?: number;
  notes?: string;
  contacts?: Omit<SupplierContact, 'id' | 'supplier_id' | 'created_at' | 'updated_at'>[];
}

export interface UpdateSupplierData extends Partial<CreateSupplierData> {
  id: string;
}

export const SUPPLIER_TYPES = [
  { value: 'vendor', label: 'Vendor' },
  { value: 'service_provider', label: 'Service Provider' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'manufacturer', label: 'Manufacturer' },
] as const;

export const SUPPLIER_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'blacklisted', label: 'Blacklisted' },
] as const;

export const SUPPLIER_CATEGORIES = [
  { value: 'raw_materials', label: 'Raw Materials' },
  { value: 'finished_goods', label: 'Finished Goods' },
  { value: 'services', label: 'Services' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'logistics', label: 'Logistics' },
  { value: 'it_services', label: 'IT Services' },
  { value: 'consulting', label: 'Consulting' },
  { value: 'other', label: 'Other' },
] as const;

export const PAYMENT_TERMS = [
  { value: 'net_30', label: 'Net 30' },
  { value: 'net_60', label: 'Net 60' },
  { value: 'net_90', label: 'Net 90' },
  { value: 'due_on_receipt', label: 'Due on Receipt' },
  { value: '2_10_net_30', label: '2/10 Net 30' },
  { value: 'cash_on_delivery', label: 'Cash on Delivery' },
  { value: 'advance_payment', label: 'Advance Payment' },
] as const;