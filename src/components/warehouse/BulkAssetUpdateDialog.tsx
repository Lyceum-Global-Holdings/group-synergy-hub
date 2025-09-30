import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { WarehouseLocation, WarehouseAsset } from "@/types/warehouse";
import { Loader2 } from "lucide-react";

interface BulkAssetUpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedAssetIds: Set<string>;
  locations: WarehouseLocation[];
  getLocationsByType: (type: "location" | "sublocation" | "department", parentId?: string) => WarehouseLocation[];
  onUpdate: (updateData: Partial<WarehouseAsset>) => void;
  isUpdating: boolean;
}

export function BulkAssetUpdateDialog({
  open,
  onOpenChange,
  selectedAssetIds,
  locations,
  getLocationsByType,
  onUpdate,
  isUpdating,
}: BulkAssetUpdateDialogProps) {
  const [locationId, setLocationId] = useState<string>("");
  const [sublocationId, setSublocationId] = useState<string>("");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [condition, setCondition] = useState<string>("");

  const handleSubmit = () => {
    const updateData: Partial<WarehouseAsset> = {};
    
    if (locationId) updateData.location_id = locationId;
    if (sublocationId) updateData.sublocation_id = sublocationId;
    if (departmentId) updateData.department_id = departmentId;
    if (status) updateData.status = status as WarehouseAsset['status'];
    if (condition) updateData.condition = condition as WarehouseAsset['condition'];

    // Only proceed if at least one field is selected
    if (Object.keys(updateData).length === 0) {
      return;
    }

    onUpdate(updateData);
    handleClose();
  };

  const handleClose = () => {
    setLocationId("");
    setSublocationId("");
    setDepartmentId("");
    setStatus("");
    setCondition("");
    onOpenChange(false);
  };

  const mainLocations = getLocationsByType("location");
  const sublocations = locationId ? getLocationsByType("sublocation", locationId) : [];
  const departments = sublocationId ? getLocationsByType("department", sublocationId) : [];

  const hasChanges = locationId || sublocationId || departmentId || status || condition;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Update Multiple Assets</DialogTitle>
          <DialogDescription>
            Update {selectedAssetIds.size} selected asset{selectedAssetIds.size > 1 ? 's' : ''}. 
            Only fields you select will be updated.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Location</Label>
            <Select value={locationId} onValueChange={(value) => {
              setLocationId(value);
              setSublocationId("");
              setDepartmentId("");
            }}>
              <SelectTrigger>
                <SelectValue placeholder="No change" />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-md z-50">
                <SelectItem value="__no_change__">No change</SelectItem>
                {mainLocations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Sublocation</Label>
            <Select 
              value={sublocationId} 
              onValueChange={(value) => {
                setSublocationId(value);
                setDepartmentId("");
              }}
              disabled={!locationId || locationId === "__no_change__"}
            >
              <SelectTrigger>
                <SelectValue placeholder={!locationId || locationId === "__no_change__" ? "Select location first" : "No change"} />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-md z-50">
                <SelectItem value="__no_change__">No change</SelectItem>
                {sublocations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Department</Label>
            <Select 
              value={departmentId} 
              onValueChange={setDepartmentId}
              disabled={!sublocationId || sublocationId === "__no_change__"}
            >
              <SelectTrigger>
                <SelectValue placeholder={!sublocationId || sublocationId === "__no_change__" ? "Select sublocation first" : "No change"} />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-md z-50">
                <SelectItem value="__no_change__">No change</SelectItem>
                {departments.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="No change" />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-md z-50">
                <SelectItem value="__no_change__">No change</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="disposed">Disposed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Condition</Label>
            <Select value={condition} onValueChange={setCondition}>
              <SelectTrigger>
                <SelectValue placeholder="No change" />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-md z-50">
                <SelectItem value="__no_change__">No change</SelectItem>
                <SelectItem value="good">Good</SelectItem>
                <SelectItem value="fair">Fair</SelectItem>
                <SelectItem value="poor">Poor</SelectItem>
                <SelectItem value="needs_repair">Needs Repair</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isUpdating}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!hasChanges || isUpdating}>
            {isUpdating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Update {selectedAssetIds.size} Asset{selectedAssetIds.size > 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
