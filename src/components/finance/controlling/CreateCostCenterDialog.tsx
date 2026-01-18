import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";

interface CreateCostCenterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateCostCenterDialog({ open, onOpenChange }: CreateCostCenterDialogProps) {
  const { selectedCompany } = useCompany();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    parent_id: "",
  });

  const { data: existingCostCenters } = useQuery({
    queryKey: ["cost-centers", selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cost_centers")
        .select("id, code, name")
        .eq("company_id", selectedCompany?.id)
        .eq("is_active", true)
        .order("code");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCompany?.id && open,
  });

  const createCostCenter = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("cost_centers").insert({
        code: formData.code,
        name: formData.name,
        description: formData.description || null,
        parent_id: formData.parent_id && formData.parent_id !== "none" ? formData.parent_id : null,
        company_id: selectedCompany?.id,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cost-centers"] });
      toast.success("Cost center created successfully");
      onOpenChange(false);
      setFormData({ code: "", name: "", description: "", parent_id: "" });
    },
    onError: (error) => {
      toast.error("Failed to create cost center: " + error.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Cost Center</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="code">Cost Center Code</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="e.g., CC-001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="parent">Parent Cost Center</Label>
              <Select
                value={formData.parent_id}
                onValueChange={(value) => setFormData({ ...formData, parent_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None (Top Level)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (Top Level)</SelectItem>
                  {existingCostCenters?.map((cc) => (
                    <SelectItem key={cc.id} value={cc.id}>
                      {cc.code} - {cc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Production Department"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Cost center description..."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={() => createCostCenter.mutate()} 
            disabled={!formData.code || !formData.name}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
