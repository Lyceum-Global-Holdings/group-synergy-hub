import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToolIssue } from "@/types/toolManagement";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { useToolReturns } from "@/hooks/useToolReturns";

interface ReturnToolDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeIssues: ToolIssue[];
}

export function ReturnToolDialog({ open, onOpenChange, activeIssues }: ReturnToolDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedCompany } = useCompany();
  const { createReturn, isCreating: isLegacyCreating } = useToolReturns();
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    issue_id: "",
    bin_id: "",
    return_date: format(new Date(), "yyyy-MM-dd"),
    quantity_returned: 1,
    condition: "good",
    condition_notes: "",
    returned_by_name: "",
    notes: "",
  });

  const selectedIssue = activeIssues.find((i) => i.id === formData.issue_id);
  const maxReturnQty = selectedIssue
    ? selectedIssue.quantity_issued - selectedIssue.quantity_returned
    : 1;
  const toolId = selectedIssue?.tool_id ?? null;

  // Fetch bins available at the tool's location
  const binsQuery = useQuery({
    queryKey: ["bins-for-tool", toolId],
    enabled: open && !!toolId,
    queryFn: async () => {
      const { data: tool } = await supabase
        .from("warehouse_tools")
        .select("location_id")
        .eq("id", toolId!)
        .maybeSingle();
      if (!tool?.location_id) return [];
      const { data, error } = await supabase.rpc(
        "list_bins_for_location_inherited",
        { p_location_id: tool.location_id },
      );
      if (error) throw error;
      return (data || []).filter((b: any) => (b.status ?? "active") === "active");
    },
  });

  const bins = binsQuery.data || [];
  const bpresent = bins.length > 0;

  // Default bin to issue's source bin when present
  useEffect(() => {
    if (selectedIssue?.bin_id && bins.find((b) => b.id === selectedIssue.bin_id)) {
      setFormData((f) => ({ ...f, bin_id: selectedIssue.bin_id! }));
    }
  }, [selectedIssue?.bin_id, bins]);

  const reset = () =>
    setFormData({
      issue_id: "",
      bin_id: "",
      return_date: format(new Date(), "yyyy-MM-dd"),
      quantity_returned: 1,
      condition: "good",
      condition_notes: "",
      returned_by_name: "",
      notes: "",
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIssue) return;
    setSubmitting(true);
    try {
      if (formData.bin_id && bpresent) {
        const { error } = await supabase.rpc("return_tool_to_bin", {
          p_issue_id: formData.issue_id,
          p_bin_id: formData.bin_id,
          p_quantity: formData.quantity_returned,
          p_condition: formData.condition,
          p_return_date: formData.return_date,
          p_returned_by_name: formData.returned_by_name || null,
          p_condition_notes: formData.condition_notes || null,
          p_notes: formData.notes || null,
          p_company_id: selectedCompany?.id ?? null,
        });
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ["tool-returns"] });
        queryClient.invalidateQueries({ queryKey: ["tool-issues"] });
        queryClient.invalidateQueries({ queryKey: ["tool-issues-active"] });
        queryClient.invalidateQueries({ queryKey: ["warehouse-tools"] });
        queryClient.invalidateQueries({ queryKey: ["tool-bin-allocations"] });
        toast({ title: "Success", description: "Return processed" });
        reset();
        onOpenChange(false);
      } else {
        // Legacy fallback (no bins configured for this tool)
        createReturn(
          {
            issue_id: formData.issue_id,
            return_date: formData.return_date,
            quantity_returned: formData.quantity_returned,
            condition: formData.condition,
            condition_notes: formData.condition_notes || undefined,
            returned_by_name: formData.returned_by_name || undefined,
            notes: formData.notes || undefined,
          },
          {
            onSuccess: () => {
              reset();
              onOpenChange(false);
            },
          }
        );
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to process return",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const isBusy = submitting || isLegacyCreating;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Return Tool</DialogTitle>
          <DialogDescription>Process a tool return against an active issue.</DialogDescription>
        </DialogHeader>

        {activeIssues.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No active tool issues to return.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Select Issue *</Label>
              <Select
                value={formData.issue_id}
                onValueChange={(value) => {
                  const issue = activeIssues.find((i) => i.id === value);
                  const outstanding = issue
                    ? issue.quantity_issued - issue.quantity_returned
                    : 1;
                  setFormData({
                    ...formData,
                    issue_id: value,
                    quantity_returned: outstanding,
                    bin_id: issue?.bin_id ?? "",
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an issue to return" />
                </SelectTrigger>
                <SelectContent>
                  {activeIssues.map((issue) => (
                    <SelectItem key={issue.id} value={issue.id}>
                      <div className="flex items-center gap-2">
                        <span>{issue.tool?.name || issue.tool_name_snapshot || "Unknown"}</span>
                        <span className="text-muted-foreground">→</span>
                        <span>{issue.issued_to_name}</span>
                        <Badge variant="secondary" className="text-xs">
                          {issue.quantity_issued - issue.quantity_returned} outstanding
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedIssue && bpresent && (
              <div className="space-y-2">
                <Label>Return to bin *</Label>
                <Select
                  value={formData.bin_id}
                  onValueChange={(v) => setFormData({ ...formData, bin_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a bin" />
                  </SelectTrigger>
                  <SelectContent>
                    {bins.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        <span className="font-mono text-xs mr-2">{b.bin_code}</span>
                        {b.name}
                        {selectedIssue.bin_id === b.id ? " (source)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Return Date *</Label>
                <Input
                  type="date"
                  value={formData.return_date}
                  onChange={(e) => setFormData({ ...formData, return_date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Quantity * (max {maxReturnQty})</Label>
                <Input
                  type="number"
                  min={1}
                  max={maxReturnQty}
                  value={formData.quantity_returned}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      quantity_returned: parseInt(e.target.value) || 1,
                    })
                  }
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Returned By</Label>
              <Input
                value={formData.returned_by_name}
                onChange={(e) =>
                  setFormData({ ...formData, returned_by_name: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Condition *</Label>
              <Select
                value={formData.condition}
                onValueChange={(v) => setFormData({ ...formData, condition: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="good">Good - Ready for reuse</SelectItem>
                  <SelectItem value="needs_repair">Needs Repair</SelectItem>
                  <SelectItem value="damaged">Damaged</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(formData.condition === "damaged" ||
              formData.condition === "needs_repair" ||
              formData.condition === "lost") && (
              <div className="space-y-2">
                <Label>Condition Notes *</Label>
                <Textarea
                  rows={2}
                  value={formData.condition_notes}
                  onChange={(e) =>
                    setFormData({ ...formData, condition_notes: e.target.value })
                  }
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Additional Notes</Label>
              <Textarea
                rows={2}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  isBusy ||
                  !formData.issue_id ||
                  (bpresent && !formData.bin_id) ||
                  formData.quantity_returned <= 0
                }
              >
                {isBusy ? "Processing..." : "Process Return"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
