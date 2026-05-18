import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ToolReturn, CreateToolReturnData } from "@/types/toolManagement";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/contexts/CompanyContext";

export function useToolReturns() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedCompany } = useCompany();

  const returnsQuery = useQuery({
    queryKey: ["tool-returns", selectedCompany?.id],
    queryFn: async () => {
      let query = supabase
        .from("tool_returns")
        .select(`
          *,
          issue:tool_issues(
            *,
            tool:warehouse_tools(*)
          )
        `)
        .order("created_at", { ascending: false });

      if (selectedCompany?.id) {
        query = query.eq("company_id", selectedCompany.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ToolReturn[];
    },
  });

  const createReturnMutation = useMutation({
    mutationFn: async (returnData: CreateToolReturnData) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      // Generate return number
      const returnNumber = `TR-${Date.now().toString(36).toUpperCase()}`;

      // Get the issue details
      const { data: issue, error: issueError } = await supabase
        .from("tool_issues")
        .select("*, tool:warehouse_tools(*)")
        .eq("id", returnData.issue_id)
        .single();

      if (issueError) throw issueError;
      if (!issue) throw new Error("Issue not found");

      // Create return record
      const { data: returnRecord, error: returnError } = await supabase
        .from("tool_returns")
        .insert({
          ...returnData,
          return_number: returnNumber,
          status: "completed",
          company_id: selectedCompany?.id || returnData.company_id,
          created_by: userData.user.id,
          received_by: userData.user.id,
        })
        .select()
        .single();

      if (returnError) throw returnError;

      // Update issue: increment quantity_returned and update status
      const newQuantityReturned = issue.quantity_returned + returnData.quantity_returned;
      const newStatus = newQuantityReturned >= issue.quantity_issued 
        ? "returned" 
        : "partially_returned";

      const { error: updateIssueError } = await supabase
        .from("tool_issues")
        .update({
          quantity_returned: newQuantityReturned,
          status: newStatus,
        })
        .eq("id", returnData.issue_id);

      if (updateIssueError) throw updateIssueError;

      // Update tool quantities based on condition
      const tool = issue.tool;
      if (tool) {
        let availableIncrement = 0;
        let totalDecrement = 0;

        if (returnData.condition === "good" || returnData.condition === "needs_repair") {
          availableIncrement = returnData.quantity_returned;
        } else if (returnData.condition === "lost" || returnData.condition === "damaged") {
          // Lost or severely damaged items reduce total quantity
          totalDecrement = returnData.quantity_returned;
        }

        const { error: updateToolError } = await supabase
          .from("warehouse_tools")
          .update({
            available_quantity: tool.available_quantity + availableIncrement,
            issued_quantity: tool.issued_quantity - returnData.quantity_returned,
            total_quantity: tool.total_quantity - totalDecrement,
          })
          .eq("id", tool.id);

        if (updateToolError) throw updateToolError;
      }

      // Phase 2b: post return to unified inventory ledger
      const warehouseItemId =
        (tool as any)?.warehouse_item_id ??
        (issue as any)?.warehouse_item_id ?? null;

      if (warehouseItemId) {
        const { error: ledgerError } = await supabase.rpc(
          "tool_return_post_ledger",
          {
            p_warehouse_item_id: warehouseItemId,
            p_quantity: returnData.quantity_returned,
            p_condition: returnData.condition,
            p_reference_id: returnRecord.id,
            p_company_id: selectedCompany?.id || returnData.company_id,
            p_notes: `Tool return ${returnNumber}`,
          },
        );
        if (ledgerError) console.error("tool ledger (return) failed", ledgerError);
      }

      return returnRecord;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tool-returns"] });
      queryClient.invalidateQueries({ queryKey: ["tool-issues"] });
      queryClient.invalidateQueries({ queryKey: ["tool-issues-active"] });
      queryClient.invalidateQueries({ queryKey: ["tool-issues-overdue"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-tools"] });
      toast({ title: "Success", description: "Tool return processed successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to process return",
        variant: "destructive",
      });
    },
  });

  return {
    returns: returnsQuery.data || [],
    isLoading: returnsQuery.isLoading,
    error: returnsQuery.error,
    createReturn: createReturnMutation.mutate,
    isCreating: createReturnMutation.isPending,
  };
}
