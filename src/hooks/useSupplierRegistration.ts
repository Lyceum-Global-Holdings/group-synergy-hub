import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCachedUser } from "@/lib/currentUser";
import { SupplierRegistrationRequest, DuplicateSupplier } from "@/types/supplierRegistration";
import { toast } from "sonner";
import { notifyRegistrationDecision } from "@/lib/sourcingNotify";
import { untypedRpc } from "@/lib/untypedRpc";

export interface RegistrationDuplicate {
  kind: "supplier" | "application";
  id: string;
  name: string;
  code: string | null;
  status: string;
  reasons: ("tax_id" | "email" | "phone" | "name")[];
  /** Already a supplier of the registration's company (always true for applications). */
  in_company: boolean;
}

export interface RegistrationReview {
  status: SupplierRegistrationRequest["status"];
  can_approve: boolean;
  /** The requester's reason for submitting despite possible duplicates. */
  duplicate_reason: string | null;
  duplicates: RegistrationDuplicate[];
}

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
      queryClient.invalidateQueries({ queryKey: ['supplier-registration-review', variables.id] });
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
    // The database checks for duplicates; a match needs duplicateReason.
    mutationFn: async ({ id, duplicateReason }: { id: string; duplicateReason?: string }) => {
      await untypedRpc<null>('submit_supplier_registration', {
        p_registration_id: id,
        p_duplicate_reason: duplicateReason?.trim() || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-registrations'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-registration'] });
      toast.success("Registration submitted for approval");
    },
    onError: (error: any) => {
      toast.error(`Failed to submit: ${error.message}`);
    },
  });
}

/** Duplicate matches and whether the caller can approve. */
export function useRegistrationReview(id?: string) {
  return useQuery({
    queryKey: ['supplier-registration-review', id],
    queryFn: () => untypedRpc<RegistrationReview>('supplier_registration_review', { p_registration_id: id }),
    enabled: !!id,
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
    // One database step creates the supplier with its contact and bank details
    // (or links the matching supplier), allocates it to the company and
    // approves the registration.
    mutationFn: async ({
      id,
      notes,
      duplicateReason,
      linkSupplierId,
    }: {
      id: string;
      notes?: string;
      duplicateReason?: string;
      linkSupplierId?: string;
    }) =>
      untypedRpc<string>('approve_supplier_registration', {
        p_registration_id: id,
        p_notes: notes?.trim() || null,
        p_duplicate_reason: duplicateReason?.trim() || null,
        p_link_supplier_id: linkSupplierId ?? null,
      }),
    onSuccess: (_supplierId, { id, linkSupplierId }) => {
      queryClient.invalidateQueries({ queryKey: ['supplier-registrations'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-registration-review', id] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success(linkSupplierId ? "Registration approved and linked to the existing supplier" : "Supplier approved and created");
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
