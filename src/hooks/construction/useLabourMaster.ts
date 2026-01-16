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

      if (selectedCompany?.id) {
        query = query.eq("company_id", selectedCompany.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as LabourMaster[];
    },
    enabled: !!selectedCompany?.id,
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
