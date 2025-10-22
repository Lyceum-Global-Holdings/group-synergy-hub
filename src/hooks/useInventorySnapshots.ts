import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCompany } from '@/contexts/CompanyContext';
import { InventorySnapshot, SnapshotType } from '@/types/inventoryValuation';

interface CreateSnapshotData {
  snapshot_date: string;
  snapshot_type: SnapshotType;
  snapshot_data?: any;
}

export const useInventorySnapshots = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedCompany } = useCompany();

  const { data: snapshots = [], isLoading } = useQuery({
    queryKey: ['inventory-snapshots', selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      
      const { data, error } = await supabase
        .from('inventory_snapshots')
        .select('*')
        .eq('company_id', selectedCompany.id)
        .order('snapshot_date', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as InventorySnapshot[];
    },
    enabled: !!selectedCompany?.id,
  });

  const createSnapshotMutation = useMutation({
    mutationFn: async (snapshotData: CreateSnapshotData) => {
      if (!selectedCompany?.id) throw new Error('No company selected');

      // Get current valuation data
      const { data: valuationData, error: valuationError } = await supabase.rpc(
        'calculate_inventory_valuation',
        {
          p_company_id: selectedCompany.id,
          p_valuation_date: snapshotData.snapshot_date,
        }
      );

      if (valuationError) throw valuationError;

      const totalValue = valuationData?.reduce((sum: number, item: any) => sum + (item.total_value || 0), 0) || 0;
      const rawMaterialsValue = valuationData?.filter((item: any) => item.item_type === 'raw_material')
        .reduce((sum: number, item: any) => sum + (item.total_value || 0), 0) || 0;
      const finishedGoodsValue = valuationData?.filter((item: any) => item.item_type === 'finished_good')
        .reduce((sum: number, item: any) => sum + (item.total_value || 0), 0) || 0;
      const assetsValue = valuationData?.filter((item: any) => item.item_type === 'asset')
        .reduce((sum: number, item: any) => sum + (item.total_value || 0), 0) || 0;

      const { data, error } = await supabase
        .from('inventory_snapshots')
        .insert({
          company_id: selectedCompany.id,
          snapshot_date: snapshotData.snapshot_date,
          snapshot_type: snapshotData.snapshot_type,
          total_inventory_value: totalValue,
          raw_materials_value: rawMaterialsValue,
          finished_goods_value: finishedGoodsValue,
          assets_value: assetsValue,
          item_count: valuationData?.length || 0,
          snapshot_data: valuationData,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-snapshots'] });
      toast({
        title: 'Success',
        description: 'Inventory snapshot created successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create snapshot',
        variant: 'destructive',
      });
    },
  });

  return {
    snapshots,
    isLoading,
    createSnapshot: createSnapshotMutation.mutate,
    isCreating: createSnapshotMutation.isPending,
  };
};
