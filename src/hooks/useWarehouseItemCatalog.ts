import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getCachedUser } from "@/lib/currentUser";
import { CatalogItem, CreateCatalogItemData } from '@/types/itemBin';
import { useToast } from '@/hooks/use-toast';

export const CATALOG_QUERY_KEY = ['warehouse-item-catalog'];

export function useWarehouseItemCatalog(options?: { disableFetch?: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: items = [], isLoading, error } = useQuery({
    queryKey: CATALOG_QUERY_KEY,
    queryFn: async () => {
      // Cursor-based batching to bypass the 1,000-row Supabase limit
      const BATCH_SIZE = 1000;
      const allData: any[] = [];
      let cursor: { created_at: string; id: string } | null = null;

      while (true) {
        let query = supabase
          .from('warehouse_item_catalog')
          .select('*, supplier:suppliers(id, name)')
          .order('created_at', { ascending: false })
          .order('id', { ascending: false });

        if (cursor) {
          query = query.or(
            `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`
          );
        }

        query = query.limit(BATCH_SIZE);

        const { data: batch, error: batchError } = await query;
        if (batchError) throw batchError;

        const rows = batch || [];
        allData.push(...rows);

        if (rows.length < BATCH_SIZE) break;
        const last = rows[rows.length - 1];
        cursor = { created_at: last.created_at, id: last.id };
      }

      return allData as unknown as CatalogItem[];
    },
    enabled: !(options?.disableFetch),
  });

  const createMutation = useMutation({
    mutationFn: async (
      itemData: CreateCatalogItemData & {
        /**
         * Phase 9.5: when the caller auto-generated the item_code from a
         * category prefix (e.g. `INV-ELE-ELC-086`), pass the category code
         * here. On a UNIQUE collision (concurrent insert from another
         * tab/company) we'll fetch a fresh next-code from the DB and
         * transparently retry once.
         */
        _autoCodeCategory?: string | null;
      },
    ) => {
      const user = getCachedUser();
      if (!user) throw new Error('User not authenticated');

      const { _autoCodeCategory, ...payload } = itemData;

      const insertOnce = async (codeOverride?: string) => {
        const body = codeOverride
          ? { ...payload, item_code: codeOverride, created_by: user.id }
          : { ...payload, created_by: user.id };
        return supabase
          .from('warehouse_item_catalog')
          .insert(body)
          .select()
          .single();
      };

      let { data, error } = await insertOnce();

      // Self-heal collisions when the code was auto-generated.
      if (
        error?.message?.includes('warehouse_item_catalog_item_code_key') &&
        _autoCodeCategory
      ) {
        const { data: nextCode, error: rpcErr } = await supabase.rpc(
          'next_catalog_item_code',
          { p_category_code: _autoCodeCategory },
        );
        if (!rpcErr && typeof nextCode === 'string' && nextCode.length > 0) {
          const retry = await insertOnce(nextCode);
          data = retry.data;
          error = retry.error;
        }
      }

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATALOG_QUERY_KEY });
      // Bust the next-code cache so a second item created in the same
      // session sees the freshly-allocated suffix.
      queryClient.invalidateQueries({ queryKey: ['next-catalog-item-code'] });
      toast({ title: 'Success', description: 'Catalog item created successfully' });
    },
    onError: (error: any) => {
      let msg = 'Failed to create catalog item';
      if (error?.message?.includes('warehouse_item_catalog_item_code_key')) {
        msg = 'An item with this code already exists in the catalog';
      }
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...itemData }: Partial<CatalogItem> & { id: string }) => {
      const { data, error } = await supabase
        .from('warehouse_item_catalog')
        .update(itemData)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATALOG_QUERY_KEY });
      // Stage 2 AFTER trigger propagates mirrored fields to every company's
      // warehouse_items row — refresh those caches too.
      queryClient.invalidateQueries({ queryKey: ['warehouse-items'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-inventory-page'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-catalog-page'] });
      toast({ title: 'Success', description: 'Catalog item updated successfully' });
    },
    onError: (error: any) => {
      let msg = 'Failed to update catalog item';
      if (error?.message?.includes('warehouse_item_catalog_item_code_key')) {
        msg = 'An item with this code already exists in the catalog';
      }
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, forceDelete }: { id: string; forceDelete: boolean }) => {
      const { error } = await supabase
        .from('warehouse_item_catalog')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATALOG_QUERY_KEY });
      toast({ title: 'Success', description: 'Catalog item deleted successfully' });
    },
    onError: (error: any) => {
      let msg = 'Failed to delete catalog item';
      if (error?.message?.includes('foreign key') || error?.code === '23503') {
        msg = 'Cannot delete: item is referenced by inventory records. Mark it as inactive instead.';
      }
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    },
  });

  const markInactiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('warehouse_item_catalog')
        .update({ status: 'inactive' })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATALOG_QUERY_KEY });
      toast({ title: 'Success', description: 'Catalog item marked as inactive' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to mark item as inactive', variant: 'destructive' });
    },
  });

  const bulkCreateMutation = useMutation({
    mutationFn: async (itemsData: CreateCatalogItemData[]) => {
      const user = getCachedUser();
      if (!user) throw new Error('User not authenticated');

      const withUser = itemsData.map(item => ({ ...item, created_by: user.id }));
      const { data, error } = await supabase
        .from('warehouse_item_catalog')
        .insert(withUser)
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: CATALOG_QUERY_KEY });
      toast({ title: 'Success', description: `Imported ${data.length} catalog items` });
    },
    onError: (error: any) => {
      let msg = 'Failed to import catalog items';
      if (error?.message?.includes('warehouse_item_catalog_item_code_key')) {
        msg = 'One or more items have duplicate item codes in the catalog';
      }
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    },
  });

  return {
    items,
    isLoading,
    error,
    createItem: createMutation.mutate,
    createItemAsync: createMutation.mutateAsync,
    updateItem: updateMutation.mutate,
    updateItemAsync: updateMutation.mutateAsync,
    deleteItem: ({ id, forceDelete = false }: { id: string; forceDelete?: boolean }) =>
      deleteMutation.mutate({ id, forceDelete }),
    markItemInactive: markInactiveMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isMarkingInactive: markInactiveMutation.isPending,
    bulkCreateItems: bulkCreateMutation.mutate,
    bulkCreateItemsAsync: bulkCreateMutation.mutateAsync,
    isBulkCreating: bulkCreateMutation.isPending,
  };
}
