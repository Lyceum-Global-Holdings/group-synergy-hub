import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CostumeUnit, CreateCostumeUnitData } from "@/types/costumeRental";
import { toast } from "sonner";

export function useCostumeUnits(costumeId?: string) {
  const queryClient = useQueryClient();

  const { data: units = [], isLoading, error } = useQuery({
    queryKey: ["costume-units", costumeId],
    enabled: !!costumeId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("rental_costume_units")
        .select("*")
        .eq("costume_id", costumeId)
        .order("unit_code", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CostumeUnit[];
    },
  });

  const createUnit = useMutation({
    mutationFn: async (input: CreateCostumeUnitData) => {
      const user = await supabase.auth.getUser();
      const { data, error } = await (supabase as any)
        .from("rental_costume_units")
        .insert({ ...input, created_by: user.data.user?.id })
        .select()
        .single();
      if (error) throw error;
      return data as CostumeUnit;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["costume-units"] });
      queryClient.invalidateQueries({ queryKey: ["costumes"] });
      toast.success("Unit added");
    },
    onError: (e: any) => toast.error(`Failed to add unit: ${e.message}`),
  });

  const updateUnit = useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<CreateCostumeUnitData>) => {
      const { data, error } = await (supabase as any)
        .from("rental_costume_units")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as CostumeUnit;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["costume-units"] });
      queryClient.invalidateQueries({ queryKey: ["costumes"] });
      toast.success("Unit updated");
    },
    onError: (e: any) => toast.error(`Failed to update unit: ${e.message}`),
  });

  const deleteUnit = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("rental_costume_units").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["costume-units"] });
      queryClient.invalidateQueries({ queryKey: ["costumes"] });
      toast.success("Unit removed");
    },
    onError: (e: any) => toast.error(`Failed to remove unit: ${e.message}`),
  });

  return { units, isLoading, error, createUnit, updateUnit, deleteUnit };
}
