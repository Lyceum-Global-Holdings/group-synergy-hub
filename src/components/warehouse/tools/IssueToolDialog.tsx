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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToolIssues } from "@/hooks/useToolIssues";
import { WarehouseTool } from "@/types/toolManagement";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

interface IssueToolDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tools: WarehouseTool[];
}

export function IssueToolDialog({ open, onOpenChange, tools }: IssueToolDialogProps) {
  const { createIssue, isCreating } = useToolIssues();
  const [formData, setFormData] = useState({
    tool_id: "",
    issued_to_name: "",
    department: "",
    issue_date: format(new Date(), "yyyy-MM-dd"),
    expected_return_date: "",
    quantity_issued: 1,
    purpose: "",
    notes: "",
  });

  const selectedTool = tools.find((t) => t.id === formData.tool_id);
  const availableTools = tools.filter((t) => t.available_quantity > 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createIssue({
      ...formData,
      expected_return_date: formData.expected_return_date || undefined,
    }, {
      onSuccess: () => {
        onOpenChange(false);
        setFormData({
          tool_id: "",
          issued_to_name: "",
          department: "",
          issue_date: format(new Date(), "yyyy-MM-dd"),
          expected_return_date: "",
          quantity_issued: 1,
          purpose: "",
          notes: "",
        });
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Issue Tool</DialogTitle>
          <DialogDescription>
            Issue a tool to an employee or department.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tool_id">Select Tool *</Label>
            <Select
              value={formData.tool_id}
              onValueChange={(value) => setFormData({ ...formData, tool_id: value, quantity_issued: 1 })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a tool to issue" />
              </SelectTrigger>
              <SelectContent>
                {availableTools.map((tool) => (
                  <SelectItem key={tool.id} value={tool.id}>
                    <div className="flex items-center gap-2">
                      <span>{tool.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {tool.available_quantity} available
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTool && (
              <p className="text-sm text-muted-foreground">
                Code: {selectedTool.tool_code} | Available: {selectedTool.available_quantity}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="issued_to_name">Issue To (Name) *</Label>
            <Input
              id="issued_to_name"
              value={formData.issued_to_name}
              onChange={(e) => setFormData({ ...formData, issued_to_name: e.target.value })}
              placeholder="Employee or person name"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                placeholder="e.g., Maintenance"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quantity_issued">Quantity *</Label>
              <Input
                id="quantity_issued"
                type="number"
                min="1"
                max={selectedTool?.available_quantity || 1}
                value={formData.quantity_issued}
                onChange={(e) => setFormData({ ...formData, quantity_issued: parseInt(e.target.value) || 1 })}
                required
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
            <Label htmlFor="purpose">Purpose</Label>
            <Textarea
              id="purpose"
              value={formData.purpose}
              onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
              placeholder="Reason for issuing the tool..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes..."
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isCreating || !formData.tool_id || !formData.issued_to_name}
            >
              {isCreating ? "Issuing..." : "Issue Tool"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
