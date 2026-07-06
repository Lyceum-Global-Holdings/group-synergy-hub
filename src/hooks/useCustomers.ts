import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCachedUser } from "@/lib/currentUser";
import { Customer, CreateCustomerData } from "@/types/customer";
import { toast } from "sonner";

export function useCustomers(companyId?: string) {
  const { data: customers = [], isLoading, error } = useQuery({
    queryKey: ['customers', companyId],
    queryFn: async () => {
      let query = supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (companyId) {
        query = query.eq('company_id', companyId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as Customer[];
    },
  });

  const queryClient = useQueryClient();

  const createCustomer = useMutation({
    mutationFn: async (customerData: CreateCustomerData) => {
      const user = getCachedUser();
      const insertData = {
        ...customerData,
        created_by: user?.id
      };
      
      const { data, error } = await supabase
        .from('customers')
        .insert(insertData as any) // Bypass TypeScript check for auto-generated fields
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success("Customer created successfully");
    },
    onError: (error: any) => {
      toast.error(`Failed to create customer: ${error.message}`);
    },
  });

  const updateCustomer = useMutation({
    mutationFn: async ({ id, ...updateData }: { id: string } & Partial<CreateCustomerData>) => {
      const { data, error } = await supabase
        .from('customers')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success("Customer updated successfully");
    },
    onError: (error: any) => {
      toast.error(`Failed to update customer: ${error.message}`);
    },
  });

  const deleteCustomer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success("Customer deleted successfully");
    },
    onError: (error: any) => {
      toast.error(`Failed to delete customer: ${error.message}`);
    },
  });

  return {
    customers,
    isLoading,
    error,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    isCreating: createCustomer.isPending,
    isUpdating: updateCustomer.isPending,
    isDeleting: deleteCustomer.isPending,
  };
}