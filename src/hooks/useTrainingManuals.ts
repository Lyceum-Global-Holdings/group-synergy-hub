import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCachedUser } from "@/lib/currentUser";
import { useToast } from "@/hooks/use-toast";

export interface TrainingManual {
  id: string;
  title: string;
  description: string | null;
  category: string;
  document_url: string | null;
  thumbnail_url: string | null;
  legacy_file_path: string | null;
  file_url: string | null;
  file_size: number | null;
  mime_type: string | null;
  page_count: number | null;
  version: string;
  is_published: boolean;
  display_order: number;
  tags: string[] | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface LinkPreview {
  title: string;
  description: string;
  thumbnail: string;
  favicon: string;
}

export const useTrainingManuals = () => {
  return useQuery({
    queryKey: ["training-manuals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_manuals")
        .select("*")
        .eq("is_published", true)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as TrainingManual[];
    },
  });
};

export const useCreateManual = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (manual: Omit<TrainingManual, "id" | "created_at" | "updated_at" | "created_by" | "updated_by">) => {
      const user = getCachedUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("training_manuals")
        .insert({
          ...manual,
          created_by: user.id,
          updated_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-manuals"] });
      toast({
        title: "Success",
        description: "Training manual created successfully",
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
};

export const useUpdateManual = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<TrainingManual> }) => {
      const user = getCachedUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("training_manuals")
        .update({
          ...updates,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-manuals"] });
      toast({
        title: "Success",
        description: "Training manual updated successfully",
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
};

export const useDeleteManual = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("training_manuals")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-manuals"] });
      toast({
        title: "Success",
        description: "Training manual deleted successfully",
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
};

export const useFetchLinkPreview = () => {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (url: string): Promise<LinkPreview> => {
      try {
        // Using microlink.io API for link previews
        const response = await fetch(
          `https://api.microlink.io/?url=${encodeURIComponent(url)}`
        );
        
        if (!response.ok) {
          throw new Error("Failed to fetch link preview");
        }

        const data = await response.json();
        
        return {
          title: data.data.title || "",
          description: data.data.description || "",
          thumbnail: data.data.image?.url || data.data.screenshot?.url || "",
          favicon: data.data.logo?.url || "",
        };
      } catch (error) {
        console.error("Link preview error:", error);
        throw error;
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Preview Error",
        description: "Could not fetch link preview. Please enter thumbnail URL manually.",
        variant: "destructive",
      });
    },
  });
};
