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
import { useToolIssues } from "@/hooks/useToolIssues";
import { WarehouseTool } from "@/types/toolManagement";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Plus, Minus } from "lucide-react";

interface BulkIssueToolDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tools: WarehouseTool[];
}

interface SelectedTool {
  tool_id: string;
  quantity: number;
}

export function BulkIssueToolDialog({ open, onOpenChange, tools }: BulkIssueToolDialogProps) {
  const { createIssue } = useToolIssues();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTools, setSelectedTools] = useState<SelectedTool[]>([]);
  const [formData, setFormData] = useState({
    issued_to_name: "",
    department: "",
    issue_date: format(new Date(), "yyyy-MM-dd"),
    expected_return_date: "",
    purpose: "",
    notes: "",
  });

  const availableTools = tools.filter((t) => t.available_quantity > 0);

  const toggleTool = (toolId: string) => {
    setSelectedTools((prev) => {
      const exists = prev.find((t) => t.tool_id === toolId);
      if (exists) {
        return prev.filter((t) => t.tool_id !== toolId);
      }
      return [...prev, { tool_id: toolId, quantity: 1 }];
    });
  };

  const updateQuantity = (toolId: string, quantity: number) => {
    const tool = tools.find((t) => t.id === toolId);
    if (!tool) return;
    
    const validQty = Math.max(1, Math.min(quantity, tool.available_quantity));
    setSelectedTools((prev) =>
      prev.map((t) => (t.tool_id === toolId ? { ...t, quantity: validQty } : t))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedTools.length === 0) {
      toast.error("Please select at least one tool to issue");
      return;
    }
    if (!formData.issued_to_name.trim()) {
      toast.error("Please enter the name of the person receiving the tools");
      return;
    }

    setIsSubmitting(true);
    let successCount = 0;
    let errorCount = 0;

    for (const selectedTool of selectedTools) {
      try {
        await new Promise<void>((resolve, reject) => {
          createIssue(
            {
              tool_id: selectedTool.tool_id,
              issued_to_name: formData.issued_to_name,
              department: formData.department || undefined,
              issue_date: formData.issue_date,
              expected_return_date: formData.expected_return_date || undefined,
              quantity_issued: selectedTool.quantity,
              purpose: formData.purpose || undefined,
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
      toast.success(`Successfully issued ${successCount} tool(s)`);
    }
    if (errorCount > 0) {
      toast.error(`Failed to issue ${errorCount} tool(s)`);
    }

    if (successCount > 0) {
      onOpenChange(false);
      setSelectedTools([]);
      setFormData({
        issued_to_name: "",
        department: "",
        issue_date: format(new Date(), "yyyy-MM-dd"),
        expected_return_date: "",
        purpose: "",
        notes: "",
      });
    }
  };

  const getSelectedTool = (toolId: string) => selectedTools.find((t) => t.tool_id === toolId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Bulk Issue Tools</DialogTitle>
          <DialogDescription>
            Issue multiple tools to the same person at once.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="issued_to_name">Issue To (Name) *</Label>
              <Input
                id="issued_to_name"
                value={formData.issued_to_name}
                onChange={(e) => setFormData({ ...formData, issued_to_name: e.target.value })}
                placeholder="Employee name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                placeholder="e.g., Maintenance"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="issue_date">Issue Date *</Label>
              <Input
                id="issue_date"
                type="date"
                value={formData.issue_date}
                onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expected_return_date">Expected Return</Label>
              <Input
                id="expected_return_date"
                type="date"
                value={formData.expected_return_date}
                onChange={(e) => setFormData({ ...formData, expected_return_date: e.target.value })}
                min={formData.issue_date}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Select Tools to Issue ({selectedTools.length} selected)</Label>
            <ScrollArea className="h-48 border rounded-md p-2">
              {availableTools.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No tools available for issue
                </p>
              ) : (
                <div className="space-y-2">
                  {availableTools.map((tool) => {
                    const selected = getSelectedTool(tool.id);
                    return (
                      <div
                        key={tool.id}
                        className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={!!selected}
                            onCheckedChange={() => toggleTool(tool.id)}
                          />
                          <div>
                            <p className="font-medium text-sm">{tool.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {tool.tool_code} • Available: {tool.available_quantity}
                            </p>
                          </div>
                        </div>
                        {selected && (
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => updateQuantity(tool.id, selected.quantity - 1)}
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
                              onClick={() => updateQuantity(tool.id, selected.quantity + 1)}
                              disabled={selected.quantity >= tool.available_quantity}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          <div className="space-y-2">
            <Label htmlFor="purpose">Purpose</Label>
            <Textarea
              id="purpose"
              value={formData.purpose}
              onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
              placeholder="Reason for issuing the tools..."
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || selectedTools.length === 0 || !formData.issued_to_name}
            >
              {isSubmitting ? "Issuing..." : `Issue ${selectedTools.length} Tool(s)`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
