import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useCreateCycleCount, useAddCycleCountItem } from "@/hooks/useCycleCount";
import { useWarehouseItems } from "@/hooks/useWarehouseItems";
import { useWarehouseLocations } from "@/hooks/useWarehouseLocations";
import { useUsers } from "@/hooks/useUsers";

interface CreateCycleCountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateCycleCountDialog({ open, onOpenChange }: CreateCycleCountDialogProps) {
  const [countDate, setCountDate] = useState(new Date().toISOString().split('T')[0]);
  const [countType, setCountType] = useState("ad_hoc");
  const [locationId, setLocationId] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const { locations = [] } = useWarehouseLocations();
  const { data: users = [] } = useUsers();
  const { items: warehouseItems = [] } = useWarehouseItems();
  
  const createCycleCount = useCreateCycleCount();
  const addCycleCountItem = useAddCycleCountItem();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Create cycle count
      const cycleCount = await createCycleCount.mutateAsync({
        count_date: countDate,
        count_type: countType,
        location_id: locationId || undefined,
        assigned_to: assignedTo || undefined,
        notes: notes || undefined,
      });

      // Add selected items to count
      if (cycleCount && selectedItems.length > 0) {
        for (const itemId of selectedItems) {
          const item = warehouseItems.find(i => i.id === itemId);
          if (item) {
            await addCycleCountItem.mutateAsync({
              cycle_count_id: cycleCount.id,
              warehouse_item_id: item.id,
              system_quantity: item.current_stock || 0,
              system_value: (item.current_stock || 0) * (item.unit_cost || 0),
            });
          }
        }
      }

      // Reset form
      setCountDate(new Date().toISOString().split('T')[0]);
      setCountType("ad_hoc");
      setLocationId("");
      setAssignedTo("");
      setNotes("");
      setSelectedItems([]);
      onOpenChange(false);
    } catch (error) {
      console.error("Error creating cycle count:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Cycle Count</DialogTitle>
          <DialogDescription>
            Create a new cycle count session to verify inventory accuracy
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="countDate">Count Date</Label>
              <Input
                id="countDate"
                type="date"
                value={countDate}
                onChange={(e) => setCountDate(e.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="countType">Count Type</Label>
              <Select value={countType} onValueChange={setCountType}>
                <SelectTrigger id="countType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ad_hoc">Ad Hoc</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="exception">Exception</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="locationId">Location (Optional)</Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger id="locationId">
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Locations</SelectItem>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="assignedTo">Assign To (Optional)</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger id="assignedTo">
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Not Assigned</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Items to Count</Label>
            <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
              {warehouseItems.map((item) => (
                <div key={item.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`item-${item.id}`}
                    checked={selectedItems.includes(item.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedItems([...selectedItems, item.id]);
                      } else {
                        setSelectedItems(selectedItems.filter(id => id !== item.id));
                      }
                    }}
                    className="h-4 w-4"
                  />
                  <label htmlFor={`item-${item.id}`} className="flex-1 text-sm cursor-pointer">
                    <Badge variant="outline" className="mr-2">{item.item_code}</Badge>
                    {item.name}
                  </label>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Selected: {selectedItems.length} items
            </p>
          </div>

          <div>
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes about this count..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createCycleCount.isPending || selectedItems.length === 0}
            >
              {createCycleCount.isPending ? "Creating..." : "Create Cycle Count"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
