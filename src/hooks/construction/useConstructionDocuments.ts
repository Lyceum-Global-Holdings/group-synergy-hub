import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/contexts/CompanyContext";
import type { ConstructionDocument, CreateConstructionDocumentData, UpdateConstructionDocumentData } from "@/types/construction";

type ConstructionDocumentWithProject = Omit<ConstructionDocument, 'project'> & {
  project?: { id: string; project_name: string; project_code: string } | null;
};

export function useConstructionDocuments(projectId?: string) {
  const { selectedCompany } = useCompany();

  return useQuery({
    queryKey: ["construction-documents", selectedCompany?.id, projectId],
    queryFn: async () => {
      let query = supabase
        .from("construction_documents")
        .select(`
          *,
          project:construction_projects(id, project_name, project_code)
        `)
        .order("created_at", { ascending: false });

      if (selectedCompany?.id) {
        query = query.eq("company_id", selectedCompany.id);
      }

      if (projectId) {
        query = query.eq("project_id", projectId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as ConstructionDocumentWithProject[];
    },
    enabled: !!selectedCompany?.id,
  });
}

export function useCreateConstructionDocument() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { selectedCompany } = useCompany();

  return useMutation({
    mutationFn: async (data: CreateConstructionDocumentData) => {
      const { data: user } = await supabase.auth.getUser();
      
      const insertData = {
        ...data,
        company_id: selectedCompany?.id,
        uploaded_by: user.user?.id,
      };
      
      const { data: result, error } = await supabase
        .from("construction_documents")
        .insert(insertData as any)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["construction-documents"] });
      toast({ title: "Document uploaded successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error uploading document", description: error.message, variant: "destructive" });
    },
  });
}

export function useUpdateConstructionDocument() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateConstructionDocumentData & { id: string }) => {
      const { data: result, error } = await supabase
        .from("construction_documents")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["construction-documents"] });
      toast({ title: "Document updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error updating document", description: error.message, variant: "destructive" });
    },
  });
}

export function useDeleteConstructionDocument() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("construction_documents")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["construction-documents"] });
      toast({ title: "Document deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error deleting document", description: error.message, variant: "destructive" });
    },
  });
}
