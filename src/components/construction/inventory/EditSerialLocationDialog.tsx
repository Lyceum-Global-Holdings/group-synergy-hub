import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useUpdateSerialNumber, useLocations } from "@/hooks/construction/useConstructionInventory";
import { SERIAL_CONDITIONS, SERIAL_AVAILABILITIES } from "@/types/construction-inventory";

interface SerialData {
  id: string;
  serial_number: string;
  current_location_id?: string | null;
  condition: string;
  availability: string;
  location?: { id: string; name: string } | null;
}

interface EditSerialLocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serial: SerialData | null;
}

export function EditSerialLocationDialog({
  open,
  onOpenChange,
  serial,
}: EditSerialLocationDialogProps) {
  const updateSerial = useUpdateSerialNumber();
  const { data: locations } = useLocations();

  const [locationId, setLocationId] = useState<string>("__none__");
  const [condition, setCondition] = useState<string>("working");
  const [availability, setAvailability] = useState<string>("available");

  useEffect(() => {
    if (serial && open) {
      setLocationId(serial.current_location_id || "__none__");
      setCondition(serial.condition || "working");
      setAvailability(serial.availability || "available");
    }
  }, [serial, open]);

  const handleSubmit = () => {
    if (!serial) return;

    updateSerial.mutate(
      {
        id: serial.id,
        current_location_id: locationId === "__none__" ? null : locationId,
        condition,
        availability,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Serial Number</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-muted-foreground">Serial Number</Label>
            <p className="font-mono font-medium">{serial?.serial_number}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger>
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No Location</SelectItem>
                {locations?.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="condition">Condition</Label>
            <Select value={condition} onValueChange={setCondition}>
              <SelectTrigger>
                <SelectValue placeholder="Select condition" />
              </SelectTrigger>
              <SelectContent>
                {SERIAL_CONDITIONS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="availability">Availability</Label>
            <Select value={availability} onValueChange={setAvailability}>
              <SelectTrigger>
                <SelectValue placeholder="Select availability" />
              </SelectTrigger>
              <SelectContent>
                {SERIAL_AVAILABILITIES.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={updateSerial.isPending}>
            {updateSerial.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
