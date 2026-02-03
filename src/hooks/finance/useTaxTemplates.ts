import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { toast } from 'sonner';

export interface TaxTemplate {
  id: string;
  name: string;
  description: string | null;
  tax_type: string;
  is_default: boolean | null;
  company_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaxTemplateDetail {
  id: string;
  template_id: string;
  tax_component_name: string;
  tax_rate: number;
  account_id: string | null;
  is_included_in_price: boolean | null;
  created_at: string;
}

export interface CreateTaxTemplateInput {
  name: string;
  description?: string;
  tax_type: string;
  is_default?: boolean;
}

export interface CreateTaxDetailInput {
  template_id: string;
  tax_component_name: string;
  tax_rate: number;
  account_id?: string;
  is_included_in_price?: boolean;
}

export function useTaxTemplates() {
  const { selectedCompany } = useCompany();
  const queryClient = useQueryClient();

  const { data: taxTemplates, isLoading: templatesLoading } = useQuery({
    queryKey: ['tax-templates', selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      const { data, error } = await supabase
        .from('tax_templates')
        .select('*')
        .eq('company_id', selectedCompany.id)
        .order('name');
      if (error) throw error;
      return data as TaxTemplate[];
    },
    enabled: !!selectedCompany?.id,
  });

  const { data: taxDetails, isLoading: detailsLoading } = useQuery({
    queryKey: ['tax-template-details', selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id || !taxTemplates?.length) return [];
      const templateIds = taxTemplates.map(t => t.id);
      const { data, error } = await supabase
        .from('tax_template_details')
        .select('*')
        .in('template_id', templateIds);
      if (error) throw error;
      return data as TaxTemplateDetail[];
    },
    enabled: !!selectedCompany?.id && !!taxTemplates?.length,
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (input: CreateTaxTemplateInput) => {
      const { data, error } = await supabase
        .from('tax_templates')
        .insert({ ...input, company_id: selectedCompany?.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tax-templates'] });
      toast.success('Tax template created');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const createDetailMutation = useMutation({
    mutationFn: async (input: CreateTaxDetailInput) => {
      const { data, error } = await supabase
        .from('tax_template_details')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tax-template-details'] });
      toast.success('Tax component added');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      // First delete details
      await supabase.from('tax_template_details').delete().eq('template_id', id);
      const { error } = await supabase.from('tax_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tax-templates'] });
      queryClient.invalidateQueries({ queryKey: ['tax-template-details'] });
      toast.success('Tax template deleted');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return {
    taxTemplates,
    taxDetails,
    isLoading: templatesLoading || detailsLoading,
    createTemplate: createTemplateMutation.mutate,
    createDetail: createDetailMutation.mutate,
    deleteTemplate: deleteTemplateMutation.mutate,
    isCreating: createTemplateMutation.isPending,
  };
}
