import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface UserLocationAssignment {
  id: string;
  user_id: string;
  location_id: string;
  company_id: string | null;
  is_primary: boolean;
  created_at: string;
  created_by: string | null;
  location?: {
    id: string;
    name: string;
    location_code: string | null;
    type: string;
  };
}

export function useUserLocationAssignments() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch current user's assigned locations
  const { data: myLocations = [], isLoading: isLoadingMyLocations } = useQuery({
    queryKey: ["user-location-assignments", "my", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from("user_location_assignments")
        .select(`
          *,
          location:warehouse_locations(id, name, location_code, type)
        `)
        .eq("user_id", user.id);

      if (error) throw error;
      return data as UserLocationAssignment[];
    },
    enabled: !!user?.id,
  });

  // Fetch all location assignments (for admins)
  const { data: allAssignments = [], isLoading: isLoadingAll, refetch: refetchAll } = useQuery({
    queryKey: ["user-location-assignments", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_location_assignments")
        .select(`
          *,
          location:warehouse_locations(id, name, location_code, type)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as UserLocationAssignment[];
    },
  });

  // Assign user to location
  const assignUserMutation = useMutation({
    mutationFn: async ({
      userId,
      locationId,
      companyId,
      isPrimary = false,
    }: {
      userId: string;
      locationId: string;
      companyId?: string;
      isPrimary?: boolean;
    }) => {
      const { data, error } = await supabase
        .from("user_location_assignments")
        .insert({
          user_id: userId,
          location_id: locationId,
          company_id: companyId,
          is_primary: isPrimary,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-location-assignments"] });
      toast.success("User assigned to location successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to assign user to location: ${error.message}`);
    },
  });

  // Remove user from location
  const removeUserMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase
        .from("user_location_assignments")
        .delete()
        .eq("id", assignmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-location-assignments"] });
      toast.success("User removed from location successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to remove user from location: ${error.message}`);
    },
  });

  // Update primary location
  const updatePrimaryMutation = useMutation({
    mutationFn: async ({
      assignmentId,
      isPrimary,
    }: {
      assignmentId: string;
      isPrimary: boolean;
    }) => {
      const { data, error } = await supabase
        .from("user_location_assignments")
        .update({ is_primary: isPrimary })
        .eq("id", assignmentId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-location-assignments"] });
      toast.success("Primary location updated");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update primary location: ${error.message}`);
    },
  });

  // Get assignments for a specific user
  const getAssignmentsForUser = (userId: string) => {
    return allAssignments.filter((a) => a.user_id === userId);
  };

  // Get assignments for a specific location
  const getAssignmentsForLocation = (locationId: string) => {
    return allAssignments.filter((a) => a.location_id === locationId);
  };

  // Get current user's location IDs
  const myLocationIds = myLocations.map((a) => a.location_id);

  return {
    // Current user's locations
    myLocations,
    myLocationIds,
    isLoadingMyLocations,

    // All assignments (admin view)
    allAssignments,
    isLoadingAll,
    refetchAll,

    // Mutations
    assignUser: assignUserMutation.mutate,
    assignUserAsync: assignUserMutation.mutateAsync,
    isAssigning: assignUserMutation.isPending,

    removeUser: removeUserMutation.mutate,
    removeUserAsync: removeUserMutation.mutateAsync,
    isRemoving: removeUserMutation.isPending,

    updatePrimary: updatePrimaryMutation.mutate,
    isUpdatingPrimary: updatePrimaryMutation.isPending,

    // Helpers
    getAssignmentsForUser,
    getAssignmentsForLocation,
  };
}
