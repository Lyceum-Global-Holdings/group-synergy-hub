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
        .select(`
          *,
          location:warehouse_locations!construction_labour_master_location_id_fkey(id, name)
        `)
        .order("created_at", { ascending: false });

      // Keep selected company scoping when explicitly chosen.
      // In "All Companies" mode (selectedCompany is null), rely on RLS.
      if (selectedCompany?.id) {
        query = query.or(`company_id.eq.${selectedCompany.id},company_id.is.null`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as (LabourMaster & { location?: { id: string; name: string } | null })[];
    },
    staleTime: 0,
    refetchOnMount: "always",
  });
}

export function useLabourDirectory() {
  const { selectedCompany } = useCompany();

  return useQuery({
    queryKey: ["labour-directory", selectedCompany?.id],
    queryFn: async () => {
      let query = supabase
        .from("construction_labour_directory")
        .select("*")
        .order("created_at", { ascending: false });

      if (selectedCompany?.id) {
        query = query.or(`company_id.eq.${selectedCompany.id},company_id.is.null`);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data ?? [])
        .filter((row) => !!row.id)
        .map((row) => ({
          id: row.id!,
          company_id: row.company_id,
          employee_id: row.employee_id,
          epf_no: row.epf_no,
          name: row.name ?? "Unnamed",
          trade: row.trade,
          category: row.category,
          labour_company: row.labour_company,
          skill_level: row.skill_level,
          contact_number: row.contact_number,
          email: row.email,
          hourly_rate: row.hourly_rate,
          daily_rate: row.daily_rate,
          status: row.status ?? "inactive",
          notes: row.notes,
          project_id: row.project_id,
          location_id: row.location_id,
          created_by: row.created_by,
          created_at: row.created_at ?? new Date(0).toISOString(),
          updated_at: row.updated_at ?? row.created_at ?? new Date(0).toISOString(),
        })) as LabourMaster[];
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
      queryClient.invalidateQueries({ queryKey: ["labour-directory"] });
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
      queryClient.invalidateQueries({ queryKey: ["labour-directory"] });
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
      queryClient.invalidateQueries({ queryKey: ["labour-directory"] });
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
      queryClient.invalidateQueries({ queryKey: ["labour-directory"] });
      toast({ title: "Labour record deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error deleting labour record", description: error.message, variant: "destructive" });
    },
  });
}
