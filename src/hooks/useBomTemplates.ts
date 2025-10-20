import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BomTemplate } from '@/types/bom';
import { useToast } from '@/hooks/use-toast';

export function useBomTemplates(companyId?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['bom-templates', companyId],
    queryFn: async () => {
      let query = supabase.from('bom_templates').select('*').order('created_at', { ascending: false });
      if (companyId) query = query.or(`company_id.eq.${companyId},is_public.eq.true`);
      
      const { data, error } = await query;
      if (error) throw error;
      return data as BomTemplate[];
    }
  });

  const createTemplate = useMutation({
    mutationFn: async (templateData: Partial<BomTemplate>) => {
      const user = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('bom_templates')
        .insert({
          template_name: templateData.template_name!,
          category: templateData.category,
          description: templateData.description,
          is_public: templateData.is_public || false,
          company_id: templateData.company_id,
          template_data: templateData.template_data || {},
          created_by: user.data.user?.id
        } as any)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-templates'] });
      toast({ title: "Success", description: "Template created successfully" });
    }
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('bom_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-templates'] });
      toast({ title: "Success", description: "Template deleted successfully" });
    }
  });

  return { templates, isLoading, createTemplate: createTemplate.mutateAsync, deleteTemplate: deleteTemplate.mutateAsync };
}
