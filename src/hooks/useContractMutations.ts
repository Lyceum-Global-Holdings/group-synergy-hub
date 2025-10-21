import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { CreateContractData, Contract } from "@/types/contracts";

export const useContractMutations = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const createContract = useMutation({
    mutationFn: async (data: CreateContractData) => {
      const insertData: any = {
        ...data,
        created_by: user?.id,
        company_id: user?.user_metadata?.company_id,
      };
      
      const { data: contract, error } = await supabase
        .from("contracts")
        .insert([insertData])
        .select()
        .single();

      if (error) throw error;
      return contract;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      toast.success("Contract created successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to create contract: " + error.message);
    },
  });

  const updateContract = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<Omit<Contract, 'contract_number' | 'created_at' | 'updated_at'>>;
    }) => {
      const { data: contract, error } = await supabase
        .from("contracts")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return contract;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      toast.success("Contract updated successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to update contract: " + error.message);
    },
  });

  const deleteContract = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contracts").delete().eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      toast.success("Contract deleted successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to delete contract: " + error.message);
    },
  });

  const updateContractStatus = useMutation({
    mutationFn: async ({
      id,
      status,
      notes,
    }: {
      id: string;
      status: string;
      notes?: string;
    }) => {
      const updateData: any = { status };
      if (notes) {
        updateData.notes = notes;
      }

      const { data: contract, error } = await supabase
        .from("contracts")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return contract;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      toast.success("Contract status updated successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to update status: " + error.message);
    },
  });

  return {
    createContract,
    updateContract,
    deleteContract,
    updateContractStatus,
  };
};
