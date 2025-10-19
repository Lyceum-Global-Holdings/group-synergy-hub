export interface Company {
  id: string;
  name: string;
  code: string;
  address: string | null;
  logo_url: string | null;
  status: 'active' | 'inactive';
  modules: Record<string, string[]> | string[];
  created_at: string;
  updated_at: string;
}

export interface CreateCompanyData {
  name: string;
  code: string;
  address?: string;
  logo_url?: string;
  status: 'active' | 'inactive';
  modules?: Record<string, string[]>;
}

export interface UpdateCompanyData extends Partial<CreateCompanyData> {
  id: string;
}
