import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ProjectStorageLocation {
  id: string;
  warehouse_location_id: string;
  location_name: string;
  location_code: string;
  project_id: string;
  project_name: string;
  project_code: string;
}

export interface ProjectStorageSubLocation {
  sublocation_id: string;
  sublocation_name: string;
  sublocation_code: string | null;
  parent_location_id: string;
  parent_location_name: string;
  project_id: string;
  project_name: string;
  project_code: string;
}

export const useProjectStorageLocations = () => {
  const {
    data: projectStorageLocations = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['project-storage-locations'],
    queryFn: async () => {
      // Fetch warehouse locations that are allocated to projects
      const { data, error } = await supabase
        .from('project_warehouse_allocations')
        .select(`
          id,
          warehouse_location_id,
          project_id,
          warehouse_locations:warehouse_location_id (
            id,
            name,
            location_code
          ),
          construction_projects:project_id (
            id,
            project_name,
            project_code
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform the data into a flat structure
      const locations: ProjectStorageLocation[] = (data || [])
        .filter(item => item.warehouse_locations && item.construction_projects)
        .map(item => ({
          id: item.id,
          warehouse_location_id: (item.warehouse_locations as any).id,
          location_name: (item.warehouse_locations as any).name,
          location_code: (item.warehouse_locations as any).location_code,
          project_id: (item.construction_projects as any).id,
          project_name: (item.construction_projects as any).project_name,
          project_code: (item.construction_projects as any).project_code,
        }));

      return locations;
    }
  });

  // Fetch sub-locations whose parent is allocated to a project
  const {
    data: projectSubLocations = [],
    isLoading: isLoadingSubLocations,
    error: subLocationsError
  } = useQuery({
    queryKey: ['project-storage-sublocations'],
    queryFn: async () => {
      // First get all project-allocated locations
      const { data: allocations, error: allocError } = await supabase
        .from('project_warehouse_allocations')
        .select(`
          warehouse_location_id,
          project_id,
          warehouse_locations:warehouse_location_id (
            id,
            name,
            location_code
          ),
          construction_projects:project_id (
            id,
            project_name,
            project_code
          )
        `);

      if (allocError) throw allocError;
      if (!allocations || allocations.length === 0) return [];

      // Get location IDs that are allocated to projects
      const allocatedLocationIds = allocations
        .filter(a => a.warehouse_locations)
        .map(a => (a.warehouse_locations as any).id);

      if (allocatedLocationIds.length === 0) return [];

      // Fetch sub-locations whose parent_id is in the allocated locations
      const { data: subLocations, error: subError } = await supabase
        .from('warehouse_locations')
        .select('*')
        .eq('type', 'sublocation')
        .eq('status', 'active')
        .in('parent_id', allocatedLocationIds);

      if (subError) throw subError;
      if (!subLocations || subLocations.length === 0) return [];

      // Map sub-locations with their project info
      const result: ProjectStorageSubLocation[] = subLocations
        .map(sub => {
          const allocation = allocations.find(a => (a.warehouse_locations as any)?.id === sub.parent_id);
          if (!allocation || !allocation.construction_projects) return null;

          return {
            sublocation_id: sub.id,
            sublocation_name: sub.name,
            sublocation_code: sub.location_code,
            parent_location_id: sub.parent_id!,
            parent_location_name: (allocation.warehouse_locations as any).name,
            project_id: (allocation.construction_projects as any).id,
            project_name: (allocation.construction_projects as any).project_name,
            project_code: (allocation.construction_projects as any).project_code,
          };
        })
        .filter((item): item is ProjectStorageSubLocation => item !== null);

      return result;
    }
  });

  return {
    projectStorageLocations,
    projectSubLocations,
    isLoading,
    isLoadingSubLocations,
    error,
    subLocationsError
  };
};
