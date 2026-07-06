import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCachedUser } from "@/lib/currentUser";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/contexts/CompanyContext";
import { FloorDrawing, CreateFloorDrawingData } from "@/types/construction";

export function useFloorDrawings(projectId: string | undefined) {
  return useQuery({
    queryKey: ["floor-drawings", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      
      const { data, error } = await supabase
        .from("project_floor_drawings")
        .select("*")
        .eq("project_id", projectId)
        .order("floor_number", { ascending: true });
      
      if (error) throw error;
      return data as FloorDrawing[];
    },
    enabled: !!projectId,
  });
}

export function useCreateFloorDrawing() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { selectedCompany } = useCompany();

  return useMutation({
    mutationFn: async (data: CreateFloorDrawingData) => {
      const user = { user: getCachedUser() };
      
      // Get company_id from the project if selectedCompany is not set
      let companyId = selectedCompany?.id;
      if (!companyId) {
        const { data: project } = await supabase
          .from("construction_projects")
          .select("company_id")
          .eq("id", data.project_id)
          .single();
        companyId = project?.company_id;
      }
      
      const { data: result, error } = await supabase
        .from("project_floor_drawings")
        .insert({
          ...data,
          company_id: companyId,
          created_by: user.user?.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["floor-drawings", variables.project_id] });
      toast({
        title: "Success",
        description: "Floor drawing added successfully",
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
}

export function useDeleteFloorDrawing() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, projectId }: { id: string; projectId: string }) => {
      const { error } = await supabase
        .from("project_floor_drawings")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
      return { id, projectId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["floor-drawings", data.projectId] });
      toast({
        title: "Success",
        description: "Floor drawing deleted successfully",
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
}

export async function uploadFloorDrawingImage(file: File, projectId: string): Promise<string> {
  const user = { user: getCachedUser() };
  const fileExt = file.name.split(".").pop();
  const fileName = `${user.user?.id}/${projectId}/${Date.now()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from("floor-drawings")
    .upload(fileName, file);

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage
    .from("floor-drawings")
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}
