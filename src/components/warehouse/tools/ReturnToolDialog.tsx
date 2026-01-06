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
import { useToolReturns } from "@/hooks/useToolReturns";
import { ToolIssue } from "@/types/toolManagement";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

interface ReturnToolDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeIssues: ToolIssue[];
}

export function ReturnToolDialog({ open, onOpenChange, activeIssues }: ReturnToolDialogProps) {
  const { createReturn, isCreating } = useToolReturns();
  const [formData, setFormData] = useState({
    issue_id: "",
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createReturn({
      ...formData,
      condition_notes: formData.condition_notes || undefined,
      returned_by_name: formData.returned_by_name || undefined,
    }, {
      onSuccess: () => {
        onOpenChange(false);
        setFormData({
          issue_id: "",
          return_date: format(new Date(), "yyyy-MM-dd"),
          quantity_returned: 1,
          condition: "good",
          condition_notes: "",
          returned_by_name: "",
          notes: "",
        });
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Return Tool</DialogTitle>
          <DialogDescription>
            Process a tool return against an active issue.
          </DialogDescription>
        </DialogHeader>

        {activeIssues.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No active tool issues to return.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="issue_id">Select Issue *</Label>
              <Select
                value={formData.issue_id}
                onValueChange={(value) => {
                  const issue = activeIssues.find((i) => i.id === value);
                  const outstanding = issue ? issue.quantity_issued - issue.quantity_returned : 1;
                  setFormData({ ...formData, issue_id: value, quantity_returned: outstanding });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an issue to return" />
                </SelectTrigger>
                <SelectContent>
                  {activeIssues.map((issue) => (
                    <SelectItem key={issue.id} value={issue.id}>
                      <div className="flex items-center gap-2">
                        <span>{issue.tool?.name || "Unknown Tool"}</span>
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
              {selectedIssue && (
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>Issue #: {selectedIssue.issue_number}</p>
                  <p>Issued: {selectedIssue.quantity_issued} | Returned: {selectedIssue.quantity_returned}</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
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
                <Label htmlFor="quantity_returned">Quantity *</Label>
                <Input
                  id="quantity_returned"
                  type="number"
                  min="1"
                  max={maxReturnQty}
                  value={formData.quantity_returned}
                  onChange={(e) => setFormData({ ...formData, quantity_returned: parseInt(e.target.value) || 1 })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="returned_by_name">Returned By</Label>
              <Input
                id="returned_by_name"
                value={formData.returned_by_name}
                onChange={(e) => setFormData({ ...formData, returned_by_name: e.target.value })}
                placeholder="Person returning the tool"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="condition">Condition *</Label>
              <Select
                value={formData.condition}
                onValueChange={(value) => setFormData({ ...formData, condition: value })}
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

            {(formData.condition === "damaged" || formData.condition === "needs_repair" || formData.condition === "lost") && (
              <div className="space-y-2">
                <Label htmlFor="condition_notes">Condition Notes *</Label>
                <Textarea
                  id="condition_notes"
                  value={formData.condition_notes}
                  onChange={(e) => setFormData({ ...formData, condition_notes: e.target.value })}
                  placeholder="Describe the damage or issue..."
                  rows={2}
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any other notes..."
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isCreating || !formData.issue_id}
              >
                {isCreating ? "Processing..." : "Process Return"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
