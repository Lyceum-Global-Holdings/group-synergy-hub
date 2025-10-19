export interface Company {
  id: string;
  name: string;
  code: string;
  address: string | null;
  logo_url: string | null;
  status: 'active' | 'inactive';
  modules: Record<string, string[]> | string[];
  hod_user_id: string | null;
  manager_user_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompanyApprover {
  id: string;
  company_id: string;
  user_id: string;
  approval_level: 'hod' | 'manager' | 'finance' | 'procurement' | 'custom';
  department: string | null;
  is_primary: boolean;
  can_approve_up_to_amount: number | null;
  modules: string[];
  created_at: string;
  created_by: string | null;
  updated_at: string;
}

export interface CreateCompanyData {
  name: string;
  code: string;
  address?: string;
  logo_url?: string;
  status: 'active' | 'inactive';
  modules?: Record<string, string[]>;
  hod_user_id?: string;
  manager_user_id?: string;
  created_by?: string;
}

export interface UpdateCompanyData extends Partial<CreateCompanyData> {
  id: string;
}
