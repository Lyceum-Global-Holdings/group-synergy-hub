import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCachedUser } from "@/lib/currentUser";
import { SupplierRegistrationRequest, DuplicateSupplier } from "@/types/supplierRegistration";
import { toast } from "sonner";
import { notifyRegistrationDecision } from "@/lib/sourcingNotify";

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
      const user = getCachedUser();
      const { data: result, error } = await supabase
        .from('supplier_registration_requests')
        .insert({
          ...data,
          created_by: user?.id,
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
      const user = getCachedUser();
      const { data, error } = await supabase
        .from('supplier_registration_requests')
        .update({
          status: 'pending_approval',
          submitted_by: user?.id,
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
        completed_by: user?.id,
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
      const user = getCachedUser();
      
      // Get registration data
      const { data: registration, error: fetchError } = await supabase
        .from('supplier_registration_requests')
        .select('*')
        .eq('id', id)
        .single();
      
      if (fetchError) throw fetchError;

      // Create supplier from registration data with correct column mapping
      const supplierData = registration.supplier_data as Record<string, any>;

      // Generate and insert supplier with retry on duplicate code
      let supplier: any = null;
      let lastError: any = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        const { data: codeResult, error: codeError } = await supabase
          .rpc('generate_next_supplier_code', {
            p_company_id: registration.company_id
          });

        if (codeError) {
          lastError = codeError;
          break;
        }
        const supplierCode = codeResult as string;

        const { data, error } = await supabase
          .from('suppliers')
          .insert({
            supplier_code: supplierCode,
            name: supplierData.supplier_name || supplierData.name || '',
            legal_name: supplierData.supplier_name || supplierData.name || null,
            email: supplierData.email || null,
            phone: supplierData.phone || null,
            tax_id: supplierData.tax_id || null,
            supplier_type: supplierData.supplier_type || undefined,
            category: supplierData.category || null,
            material_type: supplierData.material_type || null,
            website: supplierData.website || null,
            registration_number: supplierData.registration_number || null,
            address_line1: supplierData.street_address || null,
            address_line2: null,
            city: supplierData.city || null,
            state: supplierData.state_province || null,
            postal_code: supplierData.postal_code || null,
            country: supplierData.country || null,
            payment_terms: supplierData.payment_terms || null,
            company_id: registration.company_id,
            status: 'active',
            created_by: user?.id || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as any)
          .select()
          .single();

        if (!error) {
          supplier = data;
          break;
        }

        if (error.code === '23505' && String(error.message).includes('supplier_code')) {
          // Retry on unique violation for supplier_code
          if (attempt < 3) {
            console.info(`Supplier code conflict on attempt ${attempt}, retrying...`);
            continue;
          }
        }

        lastError = error;
        break;
      }

      if (!supplier) {
        if (lastError?.code === '23505' && String(lastError.message).includes('supplier_code')) {
          throw new Error('Supplier code conflict detected. Please try again.');
        }
        if (lastError) throw lastError;
        throw new Error('Failed to create supplier');
      }

      // Create primary contact if provided
      if (supplierData.primary_contact_name && supplierData.primary_contact_email) {
        const { error: contactError } = await supabase
          .from('supplier_contacts')
          .insert([{
            supplier_id: supplier.id,
            name: supplierData.primary_contact_name,
            email: supplierData.primary_contact_email,
            phone: supplierData.primary_contact_phone || null,
            is_primary: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }]);

        if (contactError) {
          console.error('Error creating primary contact:', contactError);
        }
      }
      

      // Update registration status
      const { error: updateError } = await supabase
        .from('supplier_registration_requests')
        .update({
          status: 'approved',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          // The database allocates this supplier to the registration's company
          // as approved (migration 20260927180000).
          supplier_id: supplier.id,
        } as any)
        .eq('id', id);
      
      if (updateError) throw updateError;

      // Create workflow entry
      await supabase.from('supplier_approval_workflow').insert({
        registration_request_id: id,
        stage: 'approved',
        status: 'completed',
        completed_by: user?.id,
        completed_at: new Date().toISOString(),
        notes,
      });

      return supplier;
    },
    onSuccess: (_supplier, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['supplier-registrations'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success("Supplier approved and created");
      void notifyRegistrationDecision(id);
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
      const user = getCachedUser();
      
      const { error } = await supabase
        .from('supplier_registration_requests')
        .update({
          status: 'rejected',
          reviewed_by: user?.id,
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
        completed_by: user?.id,
        completed_at: new Date().toISOString(),
        notes: reason,
      });
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['supplier-registrations'] });
      toast.success("Registration rejected");
      void notifyRegistrationDecision(id);
    },
    onError: (error: any) => {
      toast.error(`Failed to reject: ${error.message}`);
    },
  });
}
