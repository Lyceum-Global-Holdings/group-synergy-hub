import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";
import { CreateContractData, Contract } from "@/types/contracts";

// renew_contract (migration 20260928120000) is newer than the generated types.
const rpc = <T,>(fn: string, args: Record<string, unknown>) =>
  (supabase as unknown as { rpc: (f: string, a: Record<string, unknown>) => Promise<{ data: T; error: { message: string } | null }> }).rpc(fn, args);

export const useContractMutations = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { selectedCompany } = useCompany();

  const createContract = useMutation({
    mutationFn: async (data: CreateContractData) => {
      // Saved under the company being viewed, so colleagues in it can see it.
      if (!selectedCompany?.id) throw new Error("Choose a company at the top of the page first");
      const insertData: any = {
        ...data,
        created_by: user?.id,
        company_id: selectedCompany.id,
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

  const renewContract = useMutation({
    mutationFn: async ({ id, newExpiry, note }: { id: string; newExpiry: string; note?: string }) => {
      const { data, error } = await rpc<string>("renew_contract", {
        p_contract_id: id,
        p_new_expiry: newExpiry,
        p_note: note ?? null,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["contract", id] });
      queryClient.invalidateQueries({ queryKey: ["contract-events", id] });
      toast.success("Contract renewed");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return {
    createContract,
    updateContract,
    deleteContract,
    updateContractStatus,
    renewContract,
  };
};
