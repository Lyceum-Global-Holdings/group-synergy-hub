import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import { getCachedUser } from "@/lib/currentUser";
export interface UserCompanyAccess {
  id: string;
  user_id: string;
  company_id: string;
  access_type: string;
  created_at: string;
  created_by: string | null;
}

// Fetch all company access entries for a specific user
export const useUserCompanyAccess = (userId: string | undefined) => {
  return useQuery({
    queryKey: ["user-company-access", userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from("user_company_access")
        .select("*")
        .eq("user_id", userId);

      if (error) throw error;
      return data as UserCompanyAccess[];
    },
    enabled: !!userId,
  });
};

// Assign multiple companies to a user (replaces existing access)
export const useAssignCompaniesToUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      companyIds,
      accessType = "full",
    }: {
      userId: string;
      companyIds: string[];
      accessType?: string;
    }) => {
      // First, delete existing company access for this user
      const { error: deleteError } = await supabase
        .from("user_company_access")
        .delete()
        .eq("user_id", userId);

      if (deleteError) throw deleteError;

      // If no companies to assign, we're done
      if (companyIds.length === 0) return [];

      // Insert new company access entries
      const userData = { user: getCachedUser() };
      const entries = companyIds.map((companyId) => ({
        user_id: userId,
        company_id: companyId,
        access_type: accessType,
        created_by: userData?.user?.id,
      }));

      const { data, error: insertError } = await supabase
        .from("user_company_access")
        .insert(entries)
        .select();

      if (insertError) throw insertError;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["user-company-access", variables.userId] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
};

// Add a single company access to a user
export const useAddCompanyAccess = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      companyId,
      accessType = "full",
    }: {
      userId: string;
      companyId: string;
      accessType?: string;
    }) => {
      const userData = { user: getCachedUser() };
      
      const { data, error } = await supabase
        .from("user_company_access")
        .upsert({
          user_id: userId,
          company_id: companyId,
          access_type: accessType,
          created_by: userData?.user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["user-company-access", variables.userId] });
    },
  });
};

// Remove company access from a user
export const useRemoveCompanyAccess = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      companyId,
    }: {
      userId: string;
      companyId: string;
    }) => {
      const { error } = await supabase
        .from("user_company_access")
        .delete()
        .eq("user_id", userId)
        .eq("company_id", companyId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["user-company-access", variables.userId] });
    },
  });
};
