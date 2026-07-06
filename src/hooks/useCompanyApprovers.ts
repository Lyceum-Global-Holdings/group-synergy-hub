import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCachedUser } from "@/lib/currentUser";
import { useToast } from "@/hooks/use-toast";
import type { CompanyApprover } from "@/types/company";

interface CompanyApproverFormData {
  company_id: string;
  user_id: string;
  approval_level: 'hod' | 'manager' | 'finance' | 'procurement' | 'custom';
  department?: string;
  is_primary?: boolean;
  can_approve_up_to_amount?: number;
  modules?: string[];
  created_by?: string;
}

export const useCompanyApprovers = (companyId: string) => {
  return useQuery({
    queryKey: ['company-approvers', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_approvers')
        .select(`
          *,
          profiles!company_approvers_user_id_fkey (
            full_name,
            email
          )
        `)
        .eq('company_id', companyId)
        .order('is_primary', { ascending: false })
        .order('approval_level');
      
      if (error) throw error;
      return data as CompanyApprover[];
    },
    enabled: !!companyId,
  });
};

export const useAddCompanyApprover = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (approverData: CompanyApproverFormData) => {
      const user = getCachedUser();
      
      const { data, error } = await supabase
        .from('company_approvers')
        .insert({
          ...approverData,
          created_by: user?.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['company-approvers', data.company_id] });
      toast({
        title: "Success",
        description: "Approver added successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

export const useUpdateCompanyApprover = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CompanyApproverFormData> & { id: string }) => {
      const { data, error } = await supabase
        .from('company_approvers')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['company-approvers', data.company_id] });
      toast({
        title: "Success",
        description: "Approver updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

export const useDeleteCompanyApprover = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ id, companyId }: { id: string; companyId: string }) => {
      const { error } = await supabase
        .from('company_approvers')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return { id, companyId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['company-approvers', data.companyId] });
      toast({
        title: "Success",
        description: "Approver removed successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};
