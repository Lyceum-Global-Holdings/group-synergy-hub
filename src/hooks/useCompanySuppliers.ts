import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { toast } from 'sonner';

export interface CompanySupplier {
  id: string;
  company_id: string;
  supplier_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  allocation_type: 'manual' | 'auto' | 'inherited';
  approved_by?: string;
  approved_at?: string;
  allocated_by?: string;
  allocated_at: string;
  notes?: string;
  payment_terms?: string;
  credit_limit?: number;
  is_preferred: boolean;
  created_at: string;
  updated_at: string;
  supplier?: {
    id: string;
    supplier_code: string;
    name: string;
    supplier_type: string;
    email?: string;
    phone?: string;
    status: string;
  };
  company?: {
    id: string;
    name: string;
    code: string;
  };
}

// Fetch company's allocated suppliers (all statuses)
export function useCompanySuppliers(companyId?: string) {
  const { selectedCompany } = useCompany();
  const targetCompanyId = companyId || selectedCompany?.id;

  return useQuery({
    queryKey: ['company-suppliers', targetCompanyId],
    queryFn: async (): Promise<CompanySupplier[]> => {
      const { data, error } = await supabase
        .from('company_suppliers')
        .select(`
          *,
          supplier:suppliers(id, supplier_code, name, supplier_type, email, phone, status),
          company:companies(id, name, code)
        `)
        .eq('company_id', targetCompanyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as CompanySupplier[];
    },
    enabled: !!targetCompanyId,
  });
}

// Fetch only APPROVED suppliers for a company (for dropdowns)
export function useApprovedCompanySuppliers(companyId?: string) {
  const { selectedCompany } = useCompany();
  const targetCompanyId = companyId || selectedCompany?.id;

  return useQuery({
    queryKey: ['approved-company-suppliers', targetCompanyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_suppliers')
        .select(`
          id,
          is_preferred,
          payment_terms,
          credit_limit,
          supplier:suppliers(*)
        `)
        .eq('company_id', targetCompanyId)
        .eq('status', 'approved')
        .order('is_preferred', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!targetCompanyId,
  });
}

// Allocate supplier to company
export function useAllocateSupplier() {
  const queryClient = useQueryClient();
  const { selectedCompany } = useCompany();

  return useMutation({
    mutationFn: async (data: {
      company_id: string;
      supplier_id: string;
      notes?: string;
      payment_terms?: string;
      credit_limit?: number;
      is_preferred?: boolean;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data: result, error } = await supabase
        .from('company_suppliers')
        .insert({
          ...data,
          status: 'pending',
          allocation_type: 'manual',
          allocated_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['company-suppliers', variables.company_id] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Supplier allocated to company. Pending approval.');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to allocate supplier');
    },
  });
}

// Approve/Reject supplier allocation
export function useUpdateSupplierAllocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      company_id: string;
      status: 'approved' | 'rejected' | 'suspended';
      notes?: string;
      payment_terms?: string;
      credit_limit?: number;
      is_preferred?: boolean;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const updateData: any = {
        status: data.status,
        notes: data.notes,
      };

      if (data.status === 'approved') {
        updateData.approved_at = new Date().toISOString();
        updateData.approved_by = user?.id;
      }

      if (data.payment_terms !== undefined) updateData.payment_terms = data.payment_terms;
      if (data.credit_limit !== undefined) updateData.credit_limit = data.credit_limit;
      if (data.is_preferred !== undefined) updateData.is_preferred = data.is_preferred;

      const { data: result, error } = await supabase
        .from('company_suppliers')
        .update(updateData)
        .eq('id', data.id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['company-suppliers', variables.company_id] });
      queryClient.invalidateQueries({ queryKey: ['approved-company-suppliers', variables.company_id] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success(`Supplier allocation ${variables.status}`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update allocation');
    },
  });
}

// Remove supplier allocation
export function useRemoveSupplierAllocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { id: string; company_id: string }) => {
      const { error } = await supabase
        .from('company_suppliers')
        .delete()
        .eq('id', data.id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['company-suppliers', variables.company_id] });
      queryClient.invalidateQueries({ queryKey: ['approved-company-suppliers', variables.company_id] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Supplier removed from company');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to remove supplier');
    },
  });
}
