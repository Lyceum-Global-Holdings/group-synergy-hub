export interface SupplierRegistrationRequest {
  id: string;
  request_type: 'internal' | 'self_service';
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected';
  supplier_data: any;
  documents: any[];
  submitted_by?: string;
  submitted_at?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  rejection_reason?: string;
  company_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface SupplierDocument {
  id: string;
  supplier_id?: string;
  registration_request_id?: string;
  document_type: string;
  file_name: string;
  file_url: string;
  file_size?: number;
  uploaded_by?: string;
  verified_by?: string;
  verified_at?: string;
  created_at: string;
}

export interface ApprovalWorkflow {
  id: string;
  registration_request_id: string;
  stage: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  assigned_to?: string;
  completed_by?: string;
  completed_at?: string;
  notes?: string;
  created_at: string;
}

export interface DuplicateSupplier {
  id: string;
  supplier_name: string;
  email: string;
  phone: string;
  tax_id: string;
  match_reason: 'tax_id' | 'email' | 'phone' | 'name' | 'unknown';
}
