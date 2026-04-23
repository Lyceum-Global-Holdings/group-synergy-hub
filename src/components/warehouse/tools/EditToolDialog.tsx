import { useState, useEffect, useMemo } from "react";
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
import { Badge } from "@/components/ui/badge";
import { useWarehouseTools } from "@/hooks/useWarehouseTools";
import { useItemUnits } from "@/hooks/useItemUnits";
import { useItemCategories } from "@/hooks/useItemCategories";
import { useCompany } from "@/contexts/CompanyContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { WarehouseTool } from "@/types/toolManagement";
import { buildToolCategoryOptions } from "@/features/tools/lib/toolCategories";

interface EditToolDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tool: WarehouseTool;
}

export function EditToolDialog({ open, onOpenChange, tool }: EditToolDialogProps) {
  const { updateTool, isUpdating } = useWarehouseTools();
  const { units } = useItemUnits();
  const { selectedCompany } = useCompany();
  const { allCategories } = useItemCategories(selectedCompany?.id);
  const categoryOptions = useMemo(
    () => buildToolCategoryOptions(allCategories),
    [allCategories],
  );

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category_id: "",
    location_id: "",
    unit_id: "",
    condition: "good",
    unit_cost: "",
    notes: "",
  });

  // Initialize form data when tool changes
  useEffect(() => {
    if (tool) {
      setFormData({
        name: tool.name || "",
        description: tool.description || "",
        category_id: tool.category_id || "",
        location_id: tool.location_id || "",
        unit_id: tool.unit_id || "",
        condition: tool.condition || "good",
        unit_cost: tool.unit_cost?.toString() || "",
        notes: tool.notes || "",
      });
    }
  }, [tool]);

  const { data: locations } = useQuery({
    queryKey: ["warehouse-locations-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warehouse_locations")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateTool({
      id: tool.id,
      name: formData.name,
      description: formData.description || null,
      category_id: formData.category_id || null,
      location_id: formData.location_id || null,
      unit_id: formData.unit_id || null,
      condition: formData.condition,
      unit_cost: formData.unit_cost ? parseFloat(formData.unit_cost) : null,
      notes: formData.notes || null,
    }, {
      onSuccess: () => {
        onOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Tool</DialogTitle>
          <DialogDescription>
            Update the tool details. Use "Adjust Quantity" to change quantities.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Read-only Tool Code and Quantities */}
          <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Tool Code</span>
              <span className="font-mono text-sm font-medium">{tool.tool_code}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Quantities</span>
              <div className="flex gap-2">
                <Badge variant="secondary">Total: {tool.total_quantity}</Badge>
                <Badge variant="default">Available: {tool.available_quantity}</Badge>
                <Badge variant="outline">Issued: {tool.issued_quantity}</Badge>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Tool Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Power Drill"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional description..."
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category_id">Category</Label>
              <Select
                value={formData.category_id}
                onValueChange={(value) => setFormData({ ...formData, category_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.length === 0 && (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      No Tools categories found
                    </div>
                  )}
                  {categoryOptions.map(({ category, depth }) => (
                    <SelectItem key={category.id} value={category.id}>
                      <span className={depth === 1 ? "pl-4 text-muted-foreground" : "font-medium"}>
                        {depth === 1 ? "└ " : ""}
                        {category.code ? `[${category.code}] ` : ""}
                        {category.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="location_id">Location</Label>
              <Select
                value={formData.location_id}
                onValueChange={(value) => setFormData({ ...formData, location_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {locations?.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="unit_id">Unit of Measure</Label>
            <Select
              value={formData.unit_id}
              onValueChange={(value) => setFormData({ ...formData, unit_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select unit" />
              </SelectTrigger>
              <SelectContent>
                {units?.map((unit) => (
                  <SelectItem key={unit.id} value={unit.id}>
                    {unit.name} ({unit.abbreviation})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="condition">Condition</Label>
              <Select
                value={formData.condition}
                onValueChange={(value) => setFormData({ ...formData, condition: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="good">Good</SelectItem>
                  <SelectItem value="fair">Fair</SelectItem>
                  <SelectItem value="poor">Poor</SelectItem>
                  <SelectItem value="needs_repair">Needs Repair</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit_cost">Unit Cost</Label>
              <Input
                id="unit_cost"
                type="number"
                step="0.01"
                min="0"
                value={formData.unit_cost}
                onChange={(e) => setFormData({ ...formData, unit_cost: e.target.value })}
                placeholder="0.00"
              />
            </div>
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
            <Button type="submit" disabled={isUpdating}>
              {isUpdating ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
