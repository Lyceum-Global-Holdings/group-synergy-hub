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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToolIssues } from "@/hooks/useToolIssues";
import { WarehouseTool } from "@/types/toolManagement";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface IssueToolDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tools: WarehouseTool[];
}

export function IssueToolDialog({ open, onOpenChange, tools }: IssueToolDialogProps) {
  const { createIssue, isCreating } = useToolIssues();
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [formData, setFormData] = useState({
    tool_id: "",
    issued_to_name: "",
    department: "",
    issue_date: format(new Date(), "yyyy-MM-dd"),
    expected_return_date: "",
    expected_return_time: "",
    quantity_issued: 1,
    purpose: "",
    notes: "",
  });

  const selectedTool = tools.find((t) => t.id === formData.tool_id);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createIssue({
      ...formData,
      expected_return_date: formData.expected_return_date || undefined,
      expected_return_time: formData.expected_return_time || undefined,
    }, {
      onSuccess: () => {
        onOpenChange(false);
        setFormData({
          tool_id: "",
          issued_to_name: "",
          department: "",
          issue_date: format(new Date(), "yyyy-MM-dd"),
          expected_return_date: "",
          expected_return_time: "",
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
            <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={comboboxOpen}
                  className="w-full justify-between"
                >
                  {selectedTool ? (
                    <div className="flex items-center gap-2">
                      <span>{selectedTool.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {selectedTool.available_quantity} available
                      </Badge>
                    </div>
                  ) : (
                    "Search and select a tool..."
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[350px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search by name or code..." />
                  <CommandList>
                    <CommandEmpty>No tools found.</CommandEmpty>
                    <CommandGroup>
                      {tools.map((tool) => {
                        const isUnavailable = tool.available_quantity <= 0;
                        return (
                          <CommandItem
                            key={tool.id}
                            value={`${tool.name} ${tool.tool_code}`}
                            onSelect={() => {
                              if (!isUnavailable) {
                                setFormData({ ...formData, tool_id: tool.id, quantity_issued: 1 });
                                setComboboxOpen(false);
                              }
                            }}
                            disabled={isUnavailable}
                            className={cn(
                              isUnavailable && "opacity-50 cursor-not-allowed"
                            )}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                formData.tool_id === tool.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex flex-col flex-1">
                              <div className="flex items-center gap-2">
                                <span className={isUnavailable ? "text-muted-foreground" : ""}>
                                  {tool.name}
                                </span>
                                {isUnavailable ? (
                                  <Badge variant="destructive" className="text-xs">
                                    Not Available
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-xs">
                                    {tool.available_quantity} available
                                  </Badge>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {tool.tool_code}
                              </span>
                            </div>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
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
              <Label htmlFor="expected_return_date">Expected Return Date</Label>
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
            <Label htmlFor="expected_return_time">Expected Return Time</Label>
            <Input
              id="expected_return_time"
              type="time"
              value={formData.expected_return_time}
              onChange={(e) => setFormData({ ...formData, expected_return_time: e.target.value })}
              placeholder="e.g., 17:00"
            />
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
