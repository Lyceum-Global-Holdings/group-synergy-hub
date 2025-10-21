import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";

export interface ApprovalStage {
  id: string;
  company_id: string;
  stage_order: number;
  stage_name: string;
  stage_description: string | null;
  required: boolean;
  approval_type: string;
  required_role: string | null;
  escalation_days: number;
  created_at: string;
  updated_at: string;
}

export function useApprovalStages() {
  const { selectedCompany } = useCompany();

  return useQuery({
    queryKey: ['approval-stages', selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];

      const { data, error } = await supabase
        .from('approval_stages')
        .select('*')
        .eq('company_id', selectedCompany.id)
        .order('stage_order', { ascending: true });

      if (error) throw error;
      return data as ApprovalStage[];
    },
    enabled: !!selectedCompany?.id,
  });
}

export function useApprovalStage(stageOrder: number) {
  const { selectedCompany } = useCompany();

  return useQuery({
    queryKey: ['approval-stage', selectedCompany?.id, stageOrder],
    queryFn: async () => {
      if (!selectedCompany?.id) return null;

      const { data, error } = await supabase
        .from('approval_stages')
        .select('*')
        .eq('company_id', selectedCompany.id)
        .eq('stage_order', stageOrder)
        .single();

      if (error) throw error;
      return data as ApprovalStage;
    },
    enabled: !!selectedCompany?.id && stageOrder > 0,
  });
}
