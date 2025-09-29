import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useCpoWorkflow(cpoId?: string) {
  const { data: workflowTracking = [], isLoading } = useQuery({
    queryKey: ['cpo-workflow-tracking', cpoId],
    queryFn: async () => {
      if (!cpoId) return [];
      
      const { data, error } = await supabase
        .from('customer_po_workflow_tracking')
        .select(`
          *,
          stage_completed_by_profile:profiles!customer_po_workflow_tracking_stage_completed_by_fkey(full_name, email)
        `)
        .eq('cpo_id', cpoId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: !!cpoId,
  });

  const queryClient = useQueryClient();

  const createMaterialDemandFromCPO = useMutation({
    mutationFn: async ({ cpoId, analysisDate }: { cpoId: string; analysisDate: string }) => {
      const user = await supabase.auth.getUser();
      
      // Create material demand calculation entry
      const { data, error } = await supabase
        .from('material_demand')
        .insert({
          item_code: 'CPO-DEMAND',
          item_name: `Material Demand for CPO`,
          demand_source: 'customer_po',
          reference_id: cpoId,
          demand_date: analysisDate,
          created_by: user.data.user?.id
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Update workflow tracking
      await supabase
        .from('customer_po_workflow_tracking')
        .insert({
          cpo_id: cpoId,
          material_demand_id: data.id,
          workflow_stage: 'material_demand_planned',
          stage_completed_by: user.data.user?.id,
          notes: 'Material demand planning completed'
        });
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cpo-workflow-tracking'] });
      queryClient.invalidateQueries({ queryKey: ['material-demand'] });
      toast.success("Material demand planning initiated");
    },
    onError: (error: any) => {
      toast.error(`Failed to create material demand: ${error.message}`);
    },
  });

  const createPRFromCPO = useMutation({
    mutationFn: async ({ 
      cpoId, 
      title, 
      department, 
      priority, 
      requiredDate, 
      justification,
      items 
    }: {
      cpoId: string;
      title: string;
      department?: string;
      priority: 'low' | 'medium' | 'high' | 'urgent';
      requiredDate: string;
      justification?: string;
      items: Array<{
        item_name: string;
        description?: string;
        quantity: number;
        unit_of_measure: string;
        estimated_unit_price: number;
        estimated_total_price: number;
      }>;
    }) => {
      const user = await supabase.auth.getUser();
      
      // Generate PR number (using same function as regular PRs)
      const { data: prData, error: prError } = await supabase.rpc('generate_pr_number');
      if (prError) throw prError;
      
      // Create PR
      const { data: pr, error } = await supabase
        .from('purchase_requisitions')
        .insert({
          pr_number: prData,
          title,
          department,
          priority,
          requested_date: new Date().toISOString().split('T')[0],
          required_date: requiredDate,
          justification: justification || `Material requirements for Customer PO`,
          requested_by: user.data.user?.id,
          created_by: user.data.user?.id
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Create PR items
      if (items.length > 0) {
        const { error: itemsError } = await supabase
          .from('pr_items')
          .insert(
            items.map(item => ({
              pr_id: pr.id,
              item_name: item.item_name,
              description: item.description,
              quantity: item.quantity,
              unit_of_measure: item.unit_of_measure,
              estimated_unit_price: item.estimated_unit_price,
              estimated_total_price: item.estimated_total_price
            }))
          );
        
        if (itemsError) throw itemsError;
      }
      
      // Update workflow tracking
      await supabase
        .from('customer_po_workflow_tracking')
        .insert({
          cpo_id: cpoId,
          pr_id: pr.id,
          workflow_stage: 'pr_created',
          stage_completed_by: user.data.user?.id,
          notes: `Purchase Requisition ${prData} created`
        });
      
      return pr;
    },
    onSuccess: (pr) => {
      queryClient.invalidateQueries({ queryKey: ['cpo-workflow-tracking'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-requisitions'] });
      toast.success(`Purchase Requisition ${pr.pr_number} created successfully`);
    },
    onError: (error: any) => {
      toast.error(`Failed to create PR: ${error.message}`);
    },
  });

  return {
    workflowTracking,
    isLoading,
    createMaterialDemandFromCPO,
    createPRFromCPO,
    isCreatingMaterialDemand: createMaterialDemandFromCPO.isPending,
    isCreatingPR: createPRFromCPO.isPending,
  };
}