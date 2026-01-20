import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/contexts/CompanyContext";
import type { LabourCategory, LabourCompany } from "@/types/construction";

export function useLabourCategories() {
  const { selectedCompany } = useCompany();

  return useQuery({
    queryKey: ["labour-categories", selectedCompany?.id],
    queryFn: async () => {
      let query = supabase
        .from("construction_labour_categories")
        .select("*");

      if (selectedCompany?.id) {
        query = query.or(`company_id.eq.${selectedCompany.id},company_id.is.null,is_default.eq.true`);
      } else {
        query = query.or("company_id.is.null,is_default.eq.true");
      }

      const { data, error } = await query.order("name");

      if (error) throw error;
      return data as LabourCategory[];
    },
    enabled: true,
  });
}

export function useCreateLabourCategory() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { selectedCompany } = useCompany();

  return useMutation({
    mutationFn: async (name: string) => {
      const { data: user } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("construction_labour_categories")
        .insert({
          name,
          company_id: selectedCompany?.id,
          created_by: user.user?.id,
          is_default: false,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["labour-categories"] });
      toast({ title: "Category added successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error adding category", description: error.message, variant: "destructive" });
    },
  });
}

export function useLabourCompanies() {
  const { selectedCompany } = useCompany();

  return useQuery({
    queryKey: ["labour-companies", selectedCompany?.id],
    queryFn: async () => {
      let query = supabase
        .from("construction_labour_companies")
        .select("*");

      if (selectedCompany?.id) {
        query = query.or(`company_id.eq.${selectedCompany.id},company_id.is.null,is_default.eq.true`);
      } else {
        query = query.or("company_id.is.null,is_default.eq.true");
      }

      const { data, error } = await query.order("name");

      if (error) throw error;
      return data as LabourCompany[];
    },
    enabled: true,
  });
}

export function useCreateLabourCompany() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { selectedCompany } = useCompany();

  return useMutation({
    mutationFn: async (name: string) => {
      const { data: user } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("construction_labour_companies")
        .insert({
          name,
          company_id: selectedCompany?.id,
          created_by: user.user?.id,
          is_default: false,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["labour-companies"] });
      toast({ title: "Company added successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error adding company", description: error.message, variant: "destructive" });
    },
  });
}
