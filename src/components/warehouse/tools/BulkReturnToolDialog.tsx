import { useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToolReturns } from "@/hooks/useToolReturns";
import { ToolIssue } from "@/types/toolManagement";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Plus, Minus, AlertTriangle } from "lucide-react";

interface BulkReturnToolDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeIssues: ToolIssue[];
}

interface SelectedReturn {
  issue_id: string;
  quantity: number;
  condition: string;
}

export function BulkReturnToolDialog({ open, onOpenChange, activeIssues }: BulkReturnToolDialogProps) {
  const { createReturn } = useToolReturns();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedReturns, setSelectedReturns] = useState<SelectedReturn[]>([]);
  const [formData, setFormData] = useState({
    return_date: format(new Date(), "yyyy-MM-dd"),
    returned_by_name: "",
    notes: "",
  });

  const toggleIssue = (issueId: string) => {
    setSelectedReturns((prev) => {
      const exists = prev.find((r) => r.issue_id === issueId);
      if (exists) {
        return prev.filter((r) => r.issue_id !== issueId);
      }
      const issue = activeIssues.find((i) => i.id === issueId);
      const outstanding = issue ? issue.quantity_issued - issue.quantity_returned : 1;
      return [...prev, { issue_id: issueId, quantity: outstanding, condition: "good" }];
    });
  };

  const updateQuantity = (issueId: string, quantity: number) => {
    const issue = activeIssues.find((i) => i.id === issueId);
    if (!issue) return;
    
    const maxQty = issue.quantity_issued - issue.quantity_returned;
    const validQty = Math.max(1, Math.min(quantity, maxQty));
    setSelectedReturns((prev) =>
      prev.map((r) => (r.issue_id === issueId ? { ...r, quantity: validQty } : r))
    );
  };

  const updateCondition = (issueId: string, condition: string) => {
    setSelectedReturns((prev) =>
      prev.map((r) => (r.issue_id === issueId ? { ...r, condition } : r))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedReturns.length === 0) {
      toast.error("Please select at least one issue to return");
      return;
    }

    setIsSubmitting(true);
    let successCount = 0;
    let errorCount = 0;

    for (const selectedReturn of selectedReturns) {
      try {
        await new Promise<void>((resolve, reject) => {
          createReturn(
            {
              issue_id: selectedReturn.issue_id,
              return_date: formData.return_date,
              quantity_returned: selectedReturn.quantity,
              condition: selectedReturn.condition,
              returned_by_name: formData.returned_by_name || undefined,
              notes: formData.notes || undefined,
            },
            {
              onSuccess: () => resolve(),
              onError: () => reject(),
            }
          );
        });
        successCount++;
      } catch {
        errorCount++;
      }
    }

    setIsSubmitting(false);

    if (successCount > 0) {
      toast.success(`Successfully processed ${successCount} return(s)`);
    }
    if (errorCount > 0) {
      toast.error(`Failed to process ${errorCount} return(s)`);
    }

    if (successCount > 0) {
      onOpenChange(false);
      setSelectedReturns([]);
      setFormData({
        return_date: format(new Date(), "yyyy-MM-dd"),
        returned_by_name: "",
        notes: "",
      });
    }
  };

  const getSelectedReturn = (issueId: string) => selectedReturns.find((r) => r.issue_id === issueId);

  const isOverdue = (issue: ToolIssue) => {
    if (!issue.expected_return_date) return false;
    return new Date(issue.expected_return_date) < new Date();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Return Tools</DialogTitle>
          <DialogDescription>
            Process multiple tool returns at once.
          </DialogDescription>
        </DialogHeader>

        {activeIssues.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No active tool issues to return.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="return_date">Return Date *</Label>
                <Input
                  id="return_date"
                  type="date"
                  value={formData.return_date}
                  onChange={(e) => setFormData({ ...formData, return_date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="returned_by_name">Returned By</Label>
                <Input
                  id="returned_by_name"
                  value={formData.returned_by_name}
                  onChange={(e) => setFormData({ ...formData, returned_by_name: e.target.value })}
                  placeholder="Person returning the tools"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Select Issues to Return ({selectedReturns.length} selected)</Label>
              <ScrollArea className="h-64 border rounded-md p-2">
                <div className="space-y-2">
                  {activeIssues.map((issue) => {
                    const selected = getSelectedReturn(issue.id);
                    const outstanding = issue.quantity_issued - issue.quantity_returned;
                    const overdue = isOverdue(issue);

                    return (
                      <div
                        key={issue.id}
                        className={`p-3 rounded-md border ${selected ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                      >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="flex items-start gap-3">
                            <Checkbox
                              checked={!!selected}
                              onCheckedChange={() => toggleIssue(issue.id)}
                              className="mt-1"
                            />
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-sm">
                                  {issue.tool?.name || "Unknown Tool"}
                                </p>
                                {overdue && (
                                  <Badge variant="destructive" className="text-xs">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    Overdue
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {issue.issue_number} • Issued to: {issue.issued_to_name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Outstanding: {outstanding} of {issue.quantity_issued}
                              </p>
                            </div>
                          </div>

                      {selected && (
                        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-end ml-7 sm:ml-0">
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => updateQuantity(issue.id, selected.quantity - 1)}
                                  disabled={selected.quantity <= 1}
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <Badge variant="secondary" className="min-w-[40px] justify-center">
                                  {selected.quantity}
                                </Badge>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => updateQuantity(issue.id, selected.quantity + 1)}
                                  disabled={selected.quantity >= outstanding}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                              <Select
                                value={selected.condition}
                                onValueChange={(value) => updateCondition(issue.id, value)}
                              >
                                <SelectTrigger className="h-8 w-32 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="good">Good</SelectItem>
                                  <SelectItem value="needs_repair">Needs Repair</SelectItem>
                                  <SelectItem value="damaged">Damaged</SelectItem>
                                  <SelectItem value="lost">Lost</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes for all returns..."
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || selectedReturns.length === 0}
              >
                {isSubmitting ? "Processing..." : `Return ${selectedReturns.length} Tool(s)`}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
