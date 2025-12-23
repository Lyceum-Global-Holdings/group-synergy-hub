import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Warehouse, Star, Loader2 } from "lucide-react";
import { ConstructionProject } from "@/types/construction";
import {
  useProjectWarehouseAllocations,
  useBulkUpdateAllocations,
} from "@/hooks/construction/useProjectWarehouseAllocations";
import { useWarehouseLocations } from "@/hooks/useWarehouseLocations";

interface ProjectWarehouseAllocationDialogProps {
  project: ConstructionProject | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface AllocationState {
  warehouseLocationId: string;
  isPrimary: boolean;
}

export function ProjectWarehouseAllocationDialog({
  project,
  open,
  onOpenChange,
}: ProjectWarehouseAllocationDialogProps) {
  const [allocations, setAllocations] = useState<AllocationState[]>([]);

  const { data: existingAllocations = [], isLoading: loadingAllocations } =
    useProjectWarehouseAllocations(project?.id || null);
  const { locations: warehouseLocations = [], isLoading: loadingLocations } =
    useWarehouseLocations();
  const bulkUpdate = useBulkUpdateAllocations();

  // Filter to only show top-level warehouse locations (no parent)
  const topLevelWarehouses = warehouseLocations.filter(
    (loc) => !loc.parent_id
  );

  // Initialize allocations from existing data
  useEffect(() => {
    if (existingAllocations.length > 0) {
      setAllocations(
        existingAllocations.map((a) => ({
          warehouseLocationId: a.warehouse_location_id,
          isPrimary: a.is_primary,
        }))
      );
    } else {
      setAllocations([]);
    }
  }, [existingAllocations]);

  const handleToggleWarehouse = (warehouseId: string, checked: boolean) => {
    if (checked) {
      // Add warehouse
      setAllocations((prev) => [
        ...prev,
        { warehouseLocationId: warehouseId, isPrimary: prev.length === 0 },
      ]);
    } else {
      // Remove warehouse
      const wasRemoved = allocations.find(
        (a) => a.warehouseLocationId === warehouseId
      );
      const newAllocations = allocations.filter(
        (a) => a.warehouseLocationId !== warehouseId
      );

      // If removed warehouse was primary, set first remaining as primary
      if (wasRemoved?.isPrimary && newAllocations.length > 0) {
        newAllocations[0].isPrimary = true;
      }

      setAllocations(newAllocations);
    }
  };

  const handleSetPrimary = (warehouseId: string) => {
    setAllocations((prev) =>
      prev.map((a) => ({
        ...a,
        isPrimary: a.warehouseLocationId === warehouseId,
      }))
    );
  };

  const handleSave = async () => {
    if (!project) return;

    await bulkUpdate.mutateAsync({
      projectId: project.id,
      allocations,
    });

    onOpenChange(false);
  };

  const isLoading = loadingAllocations || loadingLocations;
  const selectedIds = allocations.map((a) => a.warehouseLocationId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Warehouse className="h-5 w-5" />
            Allocate Warehouses
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Select warehouses to allocate materials from for "{project?.project_name}"
          </p>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : topLevelWarehouses.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No warehouses found. Create warehouse locations first.
          </div>
        ) : (
          <ScrollArea className="max-h-[400px] pr-4">
            <div className="space-y-3">
              {topLevelWarehouses.map((warehouse) => {
                const isSelected = selectedIds.includes(warehouse.id);
                const allocation = allocations.find(
                  (a) => a.warehouseLocationId === warehouse.id
                );

                return (
                  <div
                    key={warehouse.id}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-muted-foreground/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id={warehouse.id}
                        checked={isSelected}
                        onCheckedChange={(checked) =>
                          handleToggleWarehouse(warehouse.id, !!checked)
                        }
                      />
                      <div>
                        <Label
                          htmlFor={warehouse.id}
                          className="font-medium cursor-pointer"
                        >
                          {warehouse.name}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {warehouse.location_code || "No code"}
                        </p>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="flex items-center gap-2">
                        {allocation?.isPrimary ? (
                          <Badge variant="default" className="gap-1">
                            <Star className="h-3 w-3" />
                            Primary
                          </Badge>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSetPrimary(warehouse.id)}
                            className="text-xs"
                          >
                            Set as Primary
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={bulkUpdate.isPending}
          >
            {bulkUpdate.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Allocations"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
