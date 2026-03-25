import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";

export function useFixedAssets() {
  const { selectedCompany } = useCompany();

  return useQuery({
    queryKey: ["fixed-assets-full", selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warehouse_assets")
        .select(`
          *,
          asset_master (
            asset_name, image_url, depreciation_method, depreciation_rate,
            useful_life_years, salvage_value, purchase_price, purchase_date
          ),
          category:asset_categories!warehouse_assets_category_id_fkey(name),
          location:warehouse_locations!warehouse_assets_location_id_fkey(name)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedCompany?.id,
  });
}

export function useFixedAssetStats() {
  const { selectedCompany } = useCompany();

  return useQuery({
    queryKey: ["fixed-asset-stats", selectedCompany?.id],
    queryFn: async () => {
      const { data: assets, error } = await supabase
        .from("warehouse_assets")
        .select("id, status, current_value, purchase_price");
      if (error) throw error;

      const total = assets?.length || 0;
      const active = assets?.filter((a) => a.status === "active" || a.status === "in_use").length || 0;
      const totalValue = assets?.reduce((sum, a) => sum + (Number(a.current_value) || 0), 0) || 0;
      const totalCost = assets?.reduce((sum, a) => sum + (Number(a.purchase_price) || 0), 0) || 0;

      return { total, active, totalValue, totalCost, depreciated: totalCost - totalValue };
    },
    enabled: !!selectedCompany?.id,
  });
}

export function useAssetRevaluations() {
  const { selectedCompany } = useCompany();

  return useQuery({
    queryKey: ["asset-revaluations", selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_revaluations")
        .select(`*, asset:warehouse_assets(name, asset_code)`)
        .order("revaluation_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedCompany?.id,
  });
}

export function useCreateAssetRevaluation() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedCompany } = useCompany();

  return useMutation({
    mutationFn: async (data: {
      asset_id: string;
      old_value: number;
      new_value: number;
      reason?: string;
      revaluation_date?: string;
    }) => {
      const { error } = await supabase.from("asset_revaluations").insert({
        ...data,
        company_id: selectedCompany?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asset-revaluations"] });
      toast({ title: "Revaluation recorded successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useAssetDisposals() {
  const { selectedCompany } = useCompany();

  return useQuery({
    queryKey: ["asset-disposals", selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_disposals")
        .select(`*, asset:warehouse_assets(name, asset_code)`)
        .order("disposal_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedCompany?.id,
  });
}

export function useCreateAssetDisposal() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedCompany } = useCompany();

  return useMutation({
    mutationFn: async (data: {
      asset_id: string;
      disposal_method: string;
      proceeds: number;
      net_book_value_at_disposal: number;
      buyer_name?: string;
      notes?: string;
      disposal_date?: string;
    }) => {
      const { error } = await supabase.from("asset_disposals").insert({
        ...data,
        company_id: selectedCompany?.id,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asset-disposals"] });
      toast({ title: "Disposal recorded successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}
