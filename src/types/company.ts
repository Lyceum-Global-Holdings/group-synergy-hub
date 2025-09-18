export interface Company {
  id: string;
  name: string;
  code: string;
  address: string | null;
  status: 'active' | 'inactive';
  modules: string[];
  created_at: string;
  updated_at: string;
}

export interface CreateCompanyData {
  name: string;
  code: string;
  address?: string;
  status: 'active' | 'inactive';
  modules?: string[];
}

export interface UpdateCompanyData extends Partial<CreateCompanyData> {
  id: string;
}