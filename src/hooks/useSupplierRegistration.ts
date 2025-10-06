import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SupplierRegistrationRequest, DuplicateSupplier } from "@/types/supplierRegistration";
import { toast } from "sonner";

export function useSupplierRegistrations(companyId?: string) {
  return useQuery({
    queryKey: ['supplier-registrations', companyId],
    queryFn: async () => {
      let query = supabase
        .from('supplier_registration_requests')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (companyId) {
        query = query.eq('company_id', companyId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as SupplierRegistrationRequest[];
    },
  });
}

export function useSupplierRegistration(id: string) {
  return useQuery({
    queryKey: ['supplier-registration', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_registration_requests')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as SupplierRegistrationRequest;
    },
    enabled: !!id,
  });
}

export function useCreateRegistration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      supplier_data: any;
      company_id?: string;
      status?: string;
    }) => {
      const user = await supabase.auth.getUser();
      const { data: result, error } = await supabase
        .from('supplier_registration_requests')
        .insert({
          ...data,
          created_by: user.data.user?.id,
          status: data.status || 'draft',
        })
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-registrations'] });
      toast.success("Registration draft saved");
    },
    onError: (error: any) => {
      toast.error(`Failed to save: ${error.message}`);
    },
  });
}

export function useUpdateRegistration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<SupplierRegistrationRequest>) => {
      const { data: result, error } = await supabase
        .from('supplier_registration_requests')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['supplier-registrations'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-registration', variables.id] });
      toast.success("Registration updated");
    },
    onError: (error: any) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });
}

export function useSubmitRegistration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const user = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('supplier_registration_requests')
        .update({
          status: 'pending_approval',
          submitted_by: user.data.user?.id,
          submitted_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;

      // Create workflow entry
      await supabase.from('supplier_approval_workflow').insert({
        registration_request_id: id,
        stage: 'submitted',
        status: 'completed',
        completed_by: user.data.user?.id,
        completed_at: new Date().toISOString(),
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-registrations'] });
      toast.success("Registration submitted for approval");
    },
    onError: (error: any) => {
      toast.error(`Failed to submit: ${error.message}`);
    },
  });
}

export function useCheckDuplicates() {
  return useMutation({
    mutationFn: async (data: {
      supplier_name: string;
      email?: string;
      phone?: string;
      tax_id?: string;
    }) => {
      const { data: result, error } = await supabase.rpc('check_duplicate_supplier', {
        p_supplier_name: data.supplier_name,
        p_email: data.email,
        p_phone: data.phone,
        p_tax_id: data.tax_id,
      });
      
      if (error) throw error;
      return result as DuplicateSupplier[];
    },
  });
}

export function useApproveRegistration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      const user = await supabase.auth.getUser();
      
      // Get registration data
      const { data: registration, error: fetchError } = await supabase
        .from('supplier_registration_requests')
        .select('*')
        .eq('id', id)
        .single();
      
      if (fetchError) throw fetchError;

      // Create supplier from registration data
      const supplierData = registration.supplier_data as Record<string, any>;
      const { data: supplier, error: supplierError } = await supabase
        .from('suppliers')
        .insert({
          supplier_name: supplierData.supplier_name,
          supplier_type: supplierData.supplier_type,
          email: supplierData.email,
          phone: supplierData.phone,
          tax_id: supplierData.tax_id,
          registration_number: supplierData.registration_number,
          website: supplierData.website,
          street_address: supplierData.street_address,
          city: supplierData.city,
          state_province: supplierData.state_province,
          postal_code: supplierData.postal_code,
          country: supplierData.country,
          bank_name: supplierData.bank_name,
          bank_account_number: supplierData.bank_account_number,
          bank_branch: supplierData.bank_branch,
          swift_code: supplierData.swift_code,
          payment_terms: supplierData.payment_terms,
          category: supplierData.category,
          material_type: supplierData.material_type,
          company_id: registration.company_id,
          created_by: user.data.user?.id,
        } as any)
        .select()
        .single();
      
      if (supplierError) throw supplierError;

      // Update registration status
      const { error: updateError } = await supabase
        .from('supplier_registration_requests')
        .update({
          status: 'approved',
          reviewed_by: user.data.user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', id);
      
      if (updateError) throw updateError;

      // Create workflow entry
      await supabase.from('supplier_approval_workflow').insert({
        registration_request_id: id,
        stage: 'approved',
        status: 'completed',
        completed_by: user.data.user?.id,
        completed_at: new Date().toISOString(),
        notes,
      });

      return supplier;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-registrations'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success("Supplier approved and created");
    },
    onError: (error: any) => {
      toast.error(`Failed to approve: ${error.message}`);
    },
  });
}

export function useRejectRegistration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const user = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('supplier_registration_requests')
        .update({
          status: 'rejected',
          reviewed_by: user.data.user?.id,
          reviewed_at: new Date().toISOString(),
          rejection_reason: reason,
        })
        .eq('id', id);
      
      if (error) throw error;

      // Create workflow entry
      await supabase.from('supplier_approval_workflow').insert({
        registration_request_id: id,
        stage: 'rejected',
        status: 'completed',
        completed_by: user.data.user?.id,
        completed_at: new Date().toISOString(),
        notes: reason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-registrations'] });
      toast.success("Registration rejected");
    },
    onError: (error: any) => {
      toast.error(`Failed to reject: ${error.message}`);
    },
  });
}
