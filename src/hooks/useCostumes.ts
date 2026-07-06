import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCachedUser } from "@/lib/currentUser";
import { Costume, CreateCostumeData } from "@/types/costumeRental";
import { toast } from "sonner";

// Upload a costume image to the shared `item-images` bucket (subfolder costumes/).
export async function uploadCostumeImage(file: File): Promise<string | null> {
  const ext = file.name.split(".").pop();
  const path = `costumes/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from("item-images").upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from("item-images").getPublicUrl(path);
  return data.publicUrl;
}

export function useCostumes(companyId?: string) {
  const queryClient = useQueryClient();

  const { data: costumes = [], isLoading, error } = useQuery({
    queryKey: ["costumes", companyId],
    queryFn: async () => {
      let query = (supabase as any)
        .from("rental_costumes")
        .select("*, category:rental_categories(id, name), units:rental_costume_units(id, unit_code, status, condition, size)")
        .order("created_at", { ascending: false });
      if (companyId) query = query.eq("company_id", companyId);
      const { data, error } = await query;
      if (error) throw error;
      return ((data ?? []) as any[]).map((c) => ({
        ...c,
        total_units: Array.isArray(c.units) ? c.units.length : 0,
        available_units: Array.isArray(c.units)
          ? c.units.filter((u: any) => u.status === "available").length
          : 0,
      })) as Costume[];
    },
  });

  const createCostume = useMutation({
    mutationFn: async (input: CreateCostumeData) => {
      const user = getCachedUser();
      const { data: code, error: codeErr } = await (supabase as any).rpc("generate_costume_code");
      if (codeErr) throw codeErr;
      const { data, error } = await (supabase as any)
        .from("rental_costumes")
        .insert({ ...input, costume_code: code, created_by: user?.id })
        .select()
        .single();
      if (error) throw error;
      return data as Costume;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["costumes"] });
      toast.success("Costume created");
    },
    onError: (e: any) => toast.error(`Failed to create costume: ${e.message}`),
  });

  const updateCostume = useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<CreateCostumeData>) => {
      const { data, error } = await (supabase as any)
        .from("rental_costumes")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Costume;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["costumes"] });
      toast.success("Costume updated");
    },
    onError: (e: any) => toast.error(`Failed to update costume: ${e.message}`),
  });

  const deleteCostume = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("rental_costumes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["costumes"] });
      toast.success("Costume deleted");
    },
    onError: (e: any) => toast.error(`Failed to delete costume: ${e.message}`),
  });

  return {
    costumes,
    isLoading,
    error,
    createCostume,
    updateCostume,
    deleteCostume,
    isCreating: createCostume.isPending,
    isUpdating: updateCostume.isPending,
  };
}
