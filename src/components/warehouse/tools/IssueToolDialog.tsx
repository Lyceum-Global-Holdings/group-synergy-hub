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
import { WarehouseTool } from "@/types/toolManagement";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToolAllocationsForTool } from "@/hooks/useToolBinAllocations";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/contexts/CompanyContext";

interface IssueToolDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tools: WarehouseTool[];
}

export function IssueToolDialog({ open, onOpenChange, tools }: IssueToolDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedCompany } = useCompany();
  const [submitting, setSubmitting] = useState(false);
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [formData, setFormData] = useState({
    tool_id: "",
    bin_id: "",
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
  const { data: allocations = [] } = useToolAllocationsForTool(formData.tool_id || null);
  const selectedAlloc = allocations.find((a) => a.bin_id === formData.bin_id);
  const maxQty = selectedAlloc
    ? Number(selectedAlloc.available_quantity ?? 0)
    : selectedTool?.available_quantity ?? 0;
  const requiresBin = allocations.length > 0;

  const reset = () =>
    setFormData({
      tool_id: "",
      bin_id: "",
      issued_to_name: "",
      department: "",
      issue_date: format(new Date(), "yyyy-MM-dd"),
      expected_return_date: "",
      expected_return_time: "",
      quantity_issued: 1,
      purpose: "",
      notes: "",
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTool) return;
    setSubmitting(true);
    try {
      if (requiresBin && formData.bin_id) {
        const { error } = await supabase.rpc("issue_tool_from_bin", {
          p_tool_id: formData.tool_id,
          p_bin_id: formData.bin_id,
          p_quantity: formData.quantity_issued,
          p_issued_to_name: formData.issued_to_name,
          p_issue_date: formData.issue_date,
          p_department: formData.department || null,
          p_expected_return_date: formData.expected_return_date || null,
          p_expected_return_time: formData.expected_return_time || null,
          p_purpose: formData.purpose || null,
          p_notes: formData.notes || null,
          p_company_id: selectedCompany?.id ?? null,
        });
        if (error) throw error;
      } else {
        // Legacy path: no bin allocations exist for this tool
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) throw new Error("Not authenticated");
        const issueNumber = `TI-${Date.now().toString(36).toUpperCase()}`;
        const { error: insertErr } = await supabase.from("tool_issues").insert({
          tool_id: formData.tool_id,
          issued_to_name: formData.issued_to_name,
          department: formData.department || null,
          issue_date: formData.issue_date,
          expected_return_date: formData.expected_return_date || null,
          expected_return_time: formData.expected_return_time || null,
          quantity_issued: formData.quantity_issued,
          quantity_returned: 0,
          purpose: formData.purpose || null,
          notes: formData.notes || null,
          status: "issued",
          company_id: selectedCompany?.id ?? null,
          created_by: userData.user.id,
          issue_number: issueNumber,
        });
        if (insertErr) throw insertErr;
        await supabase
          .from("warehouse_tools")
          .update({
            available_quantity: (selectedTool.available_quantity ?? 0) - formData.quantity_issued,
            issued_quantity: (selectedTool.issued_quantity ?? 0) + formData.quantity_issued,
          })
          .eq("id", formData.tool_id);
      }
      queryClient.invalidateQueries({ queryKey: ["tool-issues"] });
      queryClient.invalidateQueries({ queryKey: ["tool-issues-active"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-tools"] });
      queryClient.invalidateQueries({ queryKey: ["tool-bin-allocations"] });
      toast({ title: "Success", description: "Tool issued successfully" });
      reset();
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to issue tool",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Issue Tool</DialogTitle>
          <DialogDescription>Issue a tool to an employee or department.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Select Tool *</Label>
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
                        {selectedTool.available_quantity} avail
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
                        const unavailable = tool.available_quantity <= 0;
                        return (
                          <CommandItem
                            key={tool.id}
                            value={`${tool.name} ${tool.tool_code}`}
                            onSelect={() => {
                              if (!unavailable) {
                                setFormData({
                                  ...formData,
                                  tool_id: tool.id,
                                  bin_id: "",
                                  quantity_issued: 1,
                                });
                                setComboboxOpen(false);
                              }
                            }}
                            disabled={unavailable}
                            className={cn(unavailable && "opacity-50 cursor-not-allowed")}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                formData.tool_id === tool.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex flex-col flex-1">
                              <div className="flex items-center gap-2">
                                <span>{tool.name}</span>
                                {unavailable ? (
                                  <Badge variant="destructive" className="text-xs">
                                    Not Available
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-xs">
                                    {tool.available_quantity} avail
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
          </div>

          {selectedTool && (
            <div className="space-y-2">
              <Label>From bin {requiresBin ? "*" : "(optional)"}</Label>
              {allocations.length === 0 ? (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                  This tool has no bin allocations. Issuing without a bin (legacy mode). Allocate to a bin from the inventory tab for full traceability.
                </div>
              ) : (
                <Select
                  value={formData.bin_id}
                  onValueChange={(v) =>
                    setFormData({ ...formData, bin_id: v, quantity_issued: 1 })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a bin" />
                  </SelectTrigger>
                  <SelectContent>
                    {allocations.map((a) => (
                      <SelectItem key={a.bin_id} value={a.bin_id}>
                        <span className="font-mono text-xs mr-2">{a.bin?.bin_code}</span>
                        {a.bin?.name} · {Number(a.available_quantity)} avail
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Issue To (Name) *</Label>
            <Input
              value={formData.issued_to_name}
              onChange={(e) => setFormData({ ...formData, issued_to_name: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Department</Label>
              <Input
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Quantity * (max {maxQty})</Label>
              <Input
                type="number"
                min={1}
                max={maxQty || undefined}
                value={formData.quantity_issued}
                onChange={(e) =>
                  setFormData({ ...formData, quantity_issued: parseInt(e.target.value) || 1 })
                }
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Issue Date *</Label>
              <Input
                type="date"
                value={formData.issue_date}
                onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Expected Return</Label>
              <Input
                type="date"
                value={formData.expected_return_date}
                onChange={(e) =>
                  setFormData({ ...formData, expected_return_date: e.target.value })
                }
                min={formData.issue_date}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Purpose</Label>
            <Textarea
              rows={2}
              value={formData.purpose}
              onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
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
                submitting ||
                !formData.tool_id ||
                !formData.issued_to_name ||
                (requiresBin && !formData.bin_id) ||
                formData.quantity_issued <= 0 ||
                (maxQty > 0 && formData.quantity_issued > maxQty)
              }
            >
              {submitting ? "Issuing..." : "Issue Tool"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
