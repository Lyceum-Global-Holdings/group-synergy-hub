import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/contexts/CompanyContext";
import type { LabourMaster, CreateLabourMasterData, UpdateLabourMasterData } from "@/types/construction";

export function useLabourMaster() {
  const { selectedCompany } = useCompany();

  return useQuery({
    queryKey: ["labour-master", selectedCompany?.id],
    queryFn: async () => {
      let query = supabase
        .from("construction_labour_master")
        .select("*")
        .order("created_at", { ascending: false });

      // Include records for the selected company OR records with null company_id
      if (selectedCompany?.id) {
        query = query.or(`company_id.eq.${selectedCompany.id},company_id.is.null`);
      } else {
        query = query.is("company_id", null);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as LabourMaster[];
    },
    staleTime: 0,
    refetchOnMount: "always",
  });
}

export function useCreateLabourMaster() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { selectedCompany } = useCompany();

  return useMutation({
    mutationFn: async (data: CreateLabourMasterData) => {
      const { data: user } = await supabase.auth.getUser();
      
      const { data: result, error } = await supabase
        .from("construction_labour_master")
        .insert({
          ...data,
          company_id: selectedCompany?.id,
          created_by: user.user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["labour-master"] });
      toast({ title: "Labour record created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error creating labour record", description: error.message, variant: "destructive" });
    },
  });
}

export function useBulkCreateLabourMaster() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { selectedCompany } = useCompany();

  return useMutation({
    mutationFn: async (items: Omit<CreateLabourMasterData, 'company_id' | 'created_by'>[]) => {
      const { data: user } = await supabase.auth.getUser();
      
      const recordsToInsert = items.map((item) => ({
        ...item,
        company_id: selectedCompany?.id,
        created_by: user.user?.id,
      }));

      const { data: result, error } = await supabase
        .from("construction_labour_master")
        .insert(recordsToInsert)
        .select();

      if (error) throw error;
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["labour-master"] });
      toast({ title: `Successfully imported ${data.length} labour records` });
    },
    onError: (error: Error) => {
      toast({ title: "Error importing labour records", description: error.message, variant: "destructive" });
    },
  });
}

export function useUpdateLabourMaster() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateLabourMasterData & { id: string }) => {
      const { data: result, error } = await supabase
        .from("construction_labour_master")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["labour-master"] });
      toast({ title: "Labour record updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error updating labour record", description: error.message, variant: "destructive" });
    },
  });
}

export function useDeleteLabourMaster() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("construction_labour_master")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["labour-master"] });
      toast({ title: "Labour record deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error deleting labour record", description: error.message, variant: "destructive" });
    },
  });
}
