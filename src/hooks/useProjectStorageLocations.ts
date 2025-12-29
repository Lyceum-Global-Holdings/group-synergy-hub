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

  return {
    projectStorageLocations,
    isLoading,
    error
  };
};
