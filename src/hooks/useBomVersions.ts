import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BomVersion } from '@/types/bom';
import { useToast } from '@/hooks/use-toast';

export function useBomVersions(bomId?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: versions = [], isLoading } = useQuery({
    queryKey: ['bom-versions', bomId],
    queryFn: async () => {
      if (!bomId) return [];
      const { data, error } = await supabase
        .from('bom_versions')
        .select('*')
        .eq('bom_id', bomId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as BomVersion[];
    },
    enabled: !!bomId
  });

  const createVersion = useMutation({
    mutationFn: async (versionData: Partial<BomVersion>) => {
      const user = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('bom_versions')
        .insert({
          bom_id: versionData.bom_id!,
          version_number: versionData.version_number!,
          version_notes: versionData.version_notes,
          changes_summary: versionData.changes_summary,
          previous_version_id: versionData.previous_version_id,
          version_data: versionData.version_data,
          created_by: user.data.user?.id
        } as any)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-versions'] });
      toast({ title: "Success", description: "Version created successfully" });
    }
  });

  return { versions, isLoading, createVersion: createVersion.mutateAsync };
}
