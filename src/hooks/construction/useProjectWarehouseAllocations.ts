import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";

export interface ProjectWarehouseAllocation {
  id: string;
  project_id: string;
  warehouse_location_id: string;
  is_primary: boolean;
  allocated_date: string;
  notes: string | null;
  company_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  warehouse_location?: {
    id: string;
    name: string;
    location_code: string | null;
    warehouse_category: string | null;
  };
}

export function useProjectWarehouseAllocations(projectId: string | null) {
  return useQuery({
    queryKey: ["project-warehouse-allocations", projectId],
    queryFn: async (): Promise<ProjectWarehouseAllocation[]> => {
      if (!projectId) return [];

      const { data, error } = await supabase
        .from("project_warehouse_allocations")
        .select(`
          *,
          warehouse_location:warehouse_locations(id, name, location_code, warehouse_category)
        `)
        .eq("project_id", projectId)
        .order("is_primary", { ascending: false });

      if (error) throw error;
      return data as ProjectWarehouseAllocation[];
    },
    enabled: !!projectId,
  });
}

export function useAllocateWarehouse() {
  const queryClient = useQueryClient();
  const { selectedCompany } = useCompany();

  return useMutation({
    mutationFn: async ({
      projectId,
      warehouseLocationId,
      isPrimary = false,
      notes,
    }: {
      projectId: string;
      warehouseLocationId: string;
      isPrimary?: boolean;
      notes?: string;
    }) => {
      // If setting as primary, first unset any existing primary
      if (isPrimary) {
        await supabase
          .from("project_warehouse_allocations")
          .update({ is_primary: false })
          .eq("project_id", projectId);
      }

      const { data, error } = await supabase
        .from("project_warehouse_allocations")
        .insert({
          project_id: projectId,
          warehouse_location_id: warehouseLocationId,
          is_primary: isPrimary,
          notes,
          company_id: selectedCompany?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["project-warehouse-allocations", variables.projectId],
      });
      toast.success("Warehouse allocated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to allocate warehouse: ${error.message}`);
    },
  });
}

export function useDeallocateWarehouse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      allocationId,
      projectId,
    }: {
      allocationId: string;
      projectId: string;
    }) => {
      const { error } = await supabase
        .from("project_warehouse_allocations")
        .delete()
        .eq("id", allocationId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["project-warehouse-allocations", variables.projectId],
      });
      toast.success("Warehouse deallocated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to deallocate warehouse: ${error.message}`);
    },
  });
}

export function useSetPrimaryWarehouse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      allocationId,
      projectId,
    }: {
      allocationId: string;
      projectId: string;
    }) => {
      // First unset all primaries for this project
      await supabase
        .from("project_warehouse_allocations")
        .update({ is_primary: false })
        .eq("project_id", projectId);

      // Set the new primary
      const { data, error } = await supabase
        .from("project_warehouse_allocations")
        .update({ is_primary: true })
        .eq("id", allocationId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["project-warehouse-allocations", variables.projectId],
      });
      toast.success("Primary warehouse updated");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update primary warehouse: ${error.message}`);
    },
  });
}

export function useBulkUpdateAllocations() {
  const queryClient = useQueryClient();
  const { selectedCompany } = useCompany();

  return useMutation({
    mutationFn: async ({
      projectId,
      allocations,
    }: {
      projectId: string;
      allocations: { warehouseLocationId: string; isPrimary: boolean }[];
    }) => {
      // Delete existing allocations
      await supabase
        .from("project_warehouse_allocations")
        .delete()
        .eq("project_id", projectId);

      // Insert new allocations
      if (allocations.length > 0) {
        const { error } = await supabase
          .from("project_warehouse_allocations")
          .insert(
            allocations.map((a) => ({
              project_id: projectId,
              warehouse_location_id: a.warehouseLocationId,
              is_primary: a.isPrimary,
              company_id: selectedCompany?.id,
            }))
          );

        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["project-warehouse-allocations", variables.projectId],
      });
      toast.success("Warehouse allocations updated");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update allocations: ${error.message}`);
    },
  });
}
