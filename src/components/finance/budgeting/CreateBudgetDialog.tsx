import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";

interface CreateBudgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateBudgetDialog({ open, onOpenChange }: CreateBudgetDialogProps) {
  const { selectedCompany } = useCompany();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    budget_name: "",
    budget_type: "operating",
    description: "",
    fiscal_year: new Date().getFullYear(),
  });

  const createBudget = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("budgets").insert({
        ...formData,
        company_id: selectedCompany?.id,
        status: "draft",
        version: 1,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      toast.success("Budget created successfully");
      onOpenChange(false);
      setFormData({ budget_name: "", budget_type: "operating", description: "", fiscal_year: new Date().getFullYear() });
    },
    onError: (error) => {
      toast.error("Failed to create budget: " + error.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Budget</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="budget_name">Budget Name</Label>
            <Input
              id="budget_name"
              value={formData.budget_name}
              onChange={(e) => setFormData({ ...formData, budget_name: e.target.value })}
              placeholder="e.g., FY 2025 Operating Budget"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="budget_type">Budget Type</Label>
            <Select
              value={formData.budget_type}
              onValueChange={(value) => setFormData({ ...formData, budget_type: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="operating">Operating</SelectItem>
                <SelectItem value="capital">Capital</SelectItem>
                <SelectItem value="project">Project</SelectItem>
                <SelectItem value="cash">Cash Flow</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Budget description..."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => createBudget.mutate()} disabled={!formData.budget_name}>
            Create Budget
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
