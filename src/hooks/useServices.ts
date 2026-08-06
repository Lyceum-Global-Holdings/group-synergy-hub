import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getCachedUser } from '@/lib/currentUser';
import { toast } from 'sonner';
import type { Service, ServicePriceHistory } from '@/types/sales';

// Company services + the shared generic templates (company_id IS NULL).
export function useServices(companyId?: string) {
  const queryClient = useQueryClient();

  const { data: services = [], isLoading } = useQuery({
    queryKey: ['services', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('services')
        .select('*')
        .or(`company_id.eq.${companyId},company_id.is.null`)
        .order('name');
      if (error) throw error;
      return (data ?? []) as Service[];
    },
  });

  const companyServices = services.filter((s) => s.company_id === companyId);
  const templates = services.filter((s) => s.company_id === null);
  // Hide templates the company has already customized.
  const customizedTemplateIds = new Set(companyServices.map((s) => s.template_id).filter(Boolean));
  const availableTemplates = templates.filter((t) => !customizedTemplateIds.has(t.id));

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['services'] });

  const createService = useMutation({
    mutationFn: async (input: Partial<Service> & { name: string; company_id: string }) => {
      const { data, error } = await (supabase as any)
        .from('services')
        .insert({ ...input, created_by: getCachedUser()?.id })
        .select()
        .single();
      if (error) throw error;
      return data as Service;
    },
    onSuccess: () => { invalidate(); toast.success('Service created'); },
    onError: (e: any) => toast.error(e.message ?? 'Failed to create service'),
  });

  const updateService = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Service> & { id: string }) => {
      const { data, error } = await (supabase as any)
        .from('services')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Service;
    },
    onSuccess: () => { invalidate(); toast.success('Service updated'); },
    onError: (e: any) => toast.error(e.message ?? 'Failed to update service'),
  });

  // Clone a generic template into the company (idempotent server-side).
  const customizeTemplate = useMutation({
    mutationFn: async (templateId: string) => {
      const { data, error } = await (supabase as any).rpc('customize_service_template', {
        p_template_id: templateId,
        p_company_id: companyId,
      });
      if (error) throw error;
      return data as Service;
    },
    onSuccess: (s) => { invalidate(); toast.success(`"${s.name}" added to your services`); },
    onError: (e: any) => toast.error(e.message ?? 'Failed to customize template'),
  });

  return {
    services: companyServices,
    templates: availableTemplates,
    allActive: companyServices.filter((s) => s.is_active),
    isLoading,
    createService,
    updateService,
    customizeTemplate,
  };
}

export function useServicePriceHistory(serviceId?: string) {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ['service-price-history', serviceId],
    enabled: !!serviceId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('service_price_history')
        .select('*')
        .eq('service_id', serviceId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ServicePriceHistory[];
    },
  });
  return { history, isLoading };
}
