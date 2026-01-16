import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/contexts/CompanyContext";
import type { SubcontractorMaster, CreateSubcontractorMasterData, UpdateSubcontractorMasterData } from "@/types/construction";

export function useSubcontractorMaster() {
  const { selectedCompany } = useCompany();

  return useQuery({
    queryKey: ["subcontractor-master", selectedCompany?.id],
    queryFn: async () => {
      let query = supabase
        .from("construction_subcontractor_master")
        .select("*")
        .order("created_at", { ascending: false });

      if (selectedCompany?.id) {
        query = query.eq("company_id", selectedCompany.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as SubcontractorMaster[];
    },
    enabled: !!selectedCompany?.id,
  });
}

export function useCreateSubcontractorMaster() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { selectedCompany } = useCompany();

  return useMutation({
    mutationFn: async (data: CreateSubcontractorMasterData) => {
      const { data: user } = await supabase.auth.getUser();
      
      const { data: result, error } = await supabase
        .from("construction_subcontractor_master")
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
      queryClient.invalidateQueries({ queryKey: ["subcontractor-master"] });
      toast({ title: "Subcontractor created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error creating subcontractor", description: error.message, variant: "destructive" });
    },
  });
}

export function useUpdateSubcontractorMaster() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateSubcontractorMasterData & { id: string }) => {
      const { data: result, error } = await supabase
        .from("construction_subcontractor_master")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subcontractor-master"] });
      toast({ title: "Subcontractor updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error updating subcontractor", description: error.message, variant: "destructive" });
    },
  });
}

export function useDeleteSubcontractorMaster() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("construction_subcontractor_master")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subcontractor-master"] });
      toast({ title: "Subcontractor deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error deleting subcontractor", description: error.message, variant: "destructive" });
    },
  });
}
