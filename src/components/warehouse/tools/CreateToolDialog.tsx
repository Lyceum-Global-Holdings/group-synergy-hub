import { useState, useMemo, useEffect } from "react";
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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWarehouseTools } from "@/hooks/useWarehouseTools";
import { useItemUnits } from "@/hooks/useItemUnits";
import { useItemCategories } from "@/hooks/useItemCategories";
import { useCompany } from "@/contexts/CompanyContext";
import { useLocationFilter } from "@/contexts/LocationFilterContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { buildToolCategoryOptions } from "@/features/tools/lib/toolCategories";

interface CreateToolDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateToolDialog({ open, onOpenChange }: CreateToolDialogProps) {
  const { createTool, isCreating } = useWarehouseTools();
  const { units } = useItemUnits();
  const { selectedCompany } = useCompany();
  const { globalLocationId } = useLocationFilter();
  const { allCategories } = useItemCategories(selectedCompany?.id);
  const categoryOptions = useMemo(
    () => buildToolCategoryOptions(allCategories),
    [allCategories],
  );

  const buildInitialFormData = () => ({
    tool_code: "",
    name: "",
    description: "",
    category_id: "",
    location_id: globalLocationId ?? "",
    unit_id: "",
    total_quantity: 1,
    condition: "good",
    unit_cost: "",
    notes: "",
  });

  const [formData, setFormData] = useState(buildInitialFormData);

  // Re-sync the location field with the active global location whenever the
  // dialog is reopened or the global filter changes (SAP EWM default storage
  // location pattern). Only auto-fills if user hasn't picked something else.
  useEffect(() => {
    if (!open) return;
    setFormData((prev) =>
      prev.location_id ? prev : { ...prev, location_id: globalLocationId ?? "" },
    );
  }, [open, globalLocationId]);

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

  const isAutoFilled =
    !!globalLocationId && formData.location_id === globalLocationId;
  const locationMissing = !formData.location_id;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (locationMissing) return;
    createTool({
      ...formData,
      category_id: formData.category_id || undefined,
      location_id: formData.location_id || undefined,
      unit_id: formData.unit_id || undefined,
      unit_cost: formData.unit_cost ? parseFloat(formData.unit_cost) : undefined,
    }, {
      onSuccess: () => {
        onOpenChange(false);
        setFormData(buildInitialFormData());
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Tool</DialogTitle>
          <DialogDescription>
            Add a new tool to the inventory for tracking and issuing.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Row 1: Tool Code, Tool Name, Quantity */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tool_code">Tool Code</Label>
              <Input
                id="tool_code"
                value={formData.tool_code}
                onChange={(e) => setFormData({ ...formData, tool_code: e.target.value })}
                placeholder="Auto-generated"
              />
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
              <Label htmlFor="total_quantity">Quantity *</Label>
              <Input
                id="total_quantity"
                type="number"
                min="1"
                value={formData.total_quantity}
                onChange={(e) => setFormData({ ...formData, total_quantity: parseInt(e.target.value) || 1 })}
                required
              />
            </div>
          </div>

          {/* Row 2: Category, Location, Unit of Measure */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="location_id">
                  Location <span className="text-destructive">*</span>
                </Label>
                {isAutoFilled && (
                  <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                    Auto-filled
                  </Badge>
                )}
              </div>
              <Select
                value={formData.location_id}
                onValueChange={(value) => setFormData({ ...formData, location_id: value })}
              >
                <SelectTrigger
                  aria-required="true"
                  aria-invalid={locationMissing}
                  className={locationMissing ? "border-destructive" : undefined}
                >
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
              <p className="text-xs text-muted-foreground">
                {isAutoFilled
                  ? "Auto-filled from current location filter — change if needed."
                  : globalLocationId
                    ? "Tools must belong to a site (ISO 55000)."
                    : "Select a location — tools must belong to a site (ISO 55000)."}
              </p>
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
          </div>

          {/* Row 3: Condition, Unit Cost */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

          {/* Description */}
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

          {/* Notes */}
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
            <Button type="submit" disabled={isCreating || locationMissing}>
              {isCreating ? "Creating..." : "Create Tool"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
