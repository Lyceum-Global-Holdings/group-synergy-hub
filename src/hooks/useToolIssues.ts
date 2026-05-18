import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ToolIssue, CreateToolIssueData } from "@/types/toolManagement";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/contexts/CompanyContext";
import { useInvalidateWarehouseStock } from "@/hooks/useInvalidateWarehouseStock";

export function useToolIssues() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedCompany } = useCompany();

  const issuesQuery = useQuery({
    queryKey: ["tool-issues", selectedCompany?.id],
    queryFn: async () => {
      let query = supabase
        .from("tool_issues")
        .select(`
          *,
          tool:warehouse_tools(*)
        `)
        .order("created_at", { ascending: false });

      if (selectedCompany?.id) {
        query = query.eq("company_id", selectedCompany.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ToolIssue[];
    },
  });

  const activeIssuesQuery = useQuery({
    queryKey: ["tool-issues-active", selectedCompany?.id],
    queryFn: async () => {
      let query = supabase
        .from("tool_issues")
        .select(`
          *,
          tool:warehouse_tools(*)
        `)
        .in("status", ["issued", "partially_returned", "overdue"])
        .order("issue_date", { ascending: false });

      if (selectedCompany?.id) {
        query = query.eq("company_id", selectedCompany.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ToolIssue[];
    },
  });

  const overdueIssuesQuery = useQuery({
    queryKey: ["tool-issues-overdue", selectedCompany?.id],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      let query = supabase
        .from("tool_issues")
        .select(`
          *,
          tool:warehouse_tools(*)
        `)
        .in("status", ["issued", "partially_returned"])
        .lt("expected_return_date", today)
        .order("expected_return_date", { ascending: true });

      if (selectedCompany?.id) {
        query = query.eq("company_id", selectedCompany.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ToolIssue[];
    },
  });

  const createIssueMutation = useMutation({
    mutationFn: async (issueData: CreateToolIssueData) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      // Generate issue number
      const issueNumber = `TI-${Date.now().toString(36).toUpperCase()}`;

      // Start a transaction: create issue and update tool quantities
      const { data: issue, error: issueError } = await supabase
        .from("tool_issues")
        .insert({
          ...issueData,
          issue_number: issueNumber,
          status: "issued",
          quantity_returned: 0,
          company_id: selectedCompany?.id || issueData.company_id,
          created_by: userData.user.id,
        })
        .select()
        .single();

      if (issueError) throw issueError;

      // Update tool quantities
      const { data: tool } = await supabase
        .from("warehouse_tools")
        .select("available_quantity, issued_quantity")
        .eq("id", issueData.tool_id)
        .single();

      if (tool) {
        const { error: updateError } = await supabase
          .from("warehouse_tools")
          .update({
            available_quantity: tool.available_quantity - issueData.quantity_issued,
            issued_quantity: tool.issued_quantity + issueData.quantity_issued,
          })
          .eq("id", issueData.tool_id);

        if (updateError) throw updateError;
      }

      // Phase 2b: post to unified inventory ledger via standard tables
      const warehouseItemId =
        (tool as any)?.warehouse_item_id ??
        (await supabase
          .from("warehouse_tools")
          .select("warehouse_item_id")
          .eq("id", issueData.tool_id)
          .single()).data?.warehouse_item_id;

      if (warehouseItemId) {
        const { error: ledgerError } = await supabase.rpc(
          "tool_issue_post_ledger",
          {
            p_warehouse_item_id: warehouseItemId,
            p_quantity: issueData.quantity_issued,
            p_reference_id: issue.id,
            p_company_id: selectedCompany?.id || issueData.company_id,
            p_notes: `Tool issue ${issueNumber}`,
          },
        );
        if (ledgerError) console.error("tool ledger (issue) failed", ledgerError);
      }

      return issue;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tool-issues"] });
      queryClient.invalidateQueries({ queryKey: ["tool-issues-active"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-tools"] });
      toast({ title: "Success", description: "Tool issued successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to issue tool",
        variant: "destructive",
      });
    },
  });

  const updateIssueMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ToolIssue> & { id: string }) => {
      const { data, error } = await supabase
        .from("tool_issues")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tool-issues"] });
      queryClient.invalidateQueries({ queryKey: ["tool-issues-active"] });
      toast({ title: "Success", description: "Issue updated successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update issue",
        variant: "destructive",
      });
    },
  });

  return {
    issues: issuesQuery.data || [],
    activeIssues: activeIssuesQuery.data || [],
    overdueIssues: overdueIssuesQuery.data || [],
    isLoading: issuesQuery.isLoading,
    isLoadingActive: activeIssuesQuery.isLoading,
    isLoadingOverdue: overdueIssuesQuery.isLoading,
    error: issuesQuery.error,
    createIssue: createIssueMutation.mutate,
    updateIssue: updateIssueMutation.mutate,
    isCreating: createIssueMutation.isPending,
    isUpdating: updateIssueMutation.isPending,
  };
}
