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

// Bulk allocate supplier to multiple companies
export function useBulkAllocateSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      supplier_id: string;
      allocations: Array<{
        company_id: string;
        status: 'pending' | 'approved';
        is_preferred: boolean;
        payment_terms?: string;
        credit_limit?: number;
        notes?: string;
      }>;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const allocationsToInsert = data.allocations.map(allocation => ({
        supplier_id: data.supplier_id,
        company_id: allocation.company_id,
        status: allocation.status,
        allocation_type: 'manual' as const,
        allocated_by: user?.id,
        is_preferred: allocation.is_preferred,
        payment_terms: allocation.payment_terms,
        credit_limit: allocation.credit_limit,
        notes: allocation.notes,
        approved_by: allocation.status === 'approved' ? user?.id : null,
        approved_at: allocation.status === 'approved' ? new Date().toISOString() : null,
      }));

      const { data: result, error } = await supabase
        .from('company_suppliers')
        .insert(allocationsToInsert)
        .select();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['approved-company-suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Supplier allocated to companies successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to allocate supplier');
    },
  });
}

// Update multiple allocations at once
export function useUpdateBulkAllocations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      supplier_id: string;
      allocations_to_add?: Array<{
        company_id: string;
        status: 'pending' | 'approved';
        is_preferred: boolean;
        payment_terms?: string;
        credit_limit?: number;
        notes?: string;
      }>;
      allocations_to_update?: Array<{
        id: string;
        company_id: string;
        status?: 'pending' | 'approved' | 'rejected' | 'suspended';
        is_preferred?: boolean;
        payment_terms?: string;
        credit_limit?: number;
        notes?: string;
      }>;
      allocations_to_remove?: string[];
    }) => {
      const { data: { user } } = await supabase.auth.getUser();

      // Delete removed allocations
      if (data.allocations_to_remove && data.allocations_to_remove.length > 0) {
        const { error: deleteError } = await supabase
          .from('company_suppliers')
          .delete()
          .in('id', data.allocations_to_remove);
        if (deleteError) throw deleteError;
      }

      // Insert new allocations
      if (data.allocations_to_add && data.allocations_to_add.length > 0) {
        const allocationsToInsert = data.allocations_to_add.map(allocation => ({
          supplier_id: data.supplier_id,
          company_id: allocation.company_id,
          status: allocation.status,
          allocation_type: 'manual' as const,
          allocated_by: user?.id,
          is_preferred: allocation.is_preferred,
          payment_terms: allocation.payment_terms,
          credit_limit: allocation.credit_limit,
          notes: allocation.notes,
          approved_by: allocation.status === 'approved' ? user?.id : null,
          approved_at: allocation.status === 'approved' ? new Date().toISOString() : null,
        }));

        const { error: insertError } = await supabase
          .from('company_suppliers')
          .insert(allocationsToInsert);
        if (insertError) throw insertError;
      }

      // Update existing allocations
      if (data.allocations_to_update && data.allocations_to_update.length > 0) {
        for (const allocation of data.allocations_to_update) {
          const updateData: any = {};

          // Only include defined values in the update
          if (allocation.is_preferred !== undefined) {
            updateData.is_preferred = allocation.is_preferred;
          }
          if (allocation.payment_terms !== undefined) {
            updateData.payment_terms = allocation.payment_terms || null;
          }
          if (allocation.credit_limit !== undefined) {
            updateData.credit_limit = allocation.credit_limit || null;
          }
          if (allocation.notes !== undefined) {
            updateData.notes = allocation.notes || null;
          }

          if (allocation.status) {
            updateData.status = allocation.status;
            if (allocation.status === 'approved') {
              updateData.approved_by = user?.id;
              updateData.approved_at = new Date().toISOString();
            }
          }

          const { error: updateError } = await supabase
            .from('company_suppliers')
            .update(updateData)
            .eq('id', allocation.id);
          if (updateError) throw updateError;
        }
      }

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['approved-company-suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Company allocations updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update allocations');
    },
  });
}
