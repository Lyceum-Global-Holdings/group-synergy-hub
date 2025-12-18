import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RoomCoordinate } from "@/types/construction";
import { getRoomTypeColor, useCreateRoom } from "@/hooks/construction/useFloorRooms";
import { Loader2 } from "lucide-react";

interface AddManualRoomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drawingId: string;
  coordinates: RoomCoordinate[];
  onSuccess: () => void;
}

const ROOM_TYPES = [
  { value: "bedroom", label: "Bedroom" },
  { value: "bathroom", label: "Bathroom" },
  { value: "kitchen", label: "Kitchen" },
  { value: "living", label: "Living Room" },
  { value: "dining", label: "Dining Room" },
  { value: "office", label: "Office" },
  { value: "storage", label: "Storage" },
  { value: "garage", label: "Garage" },
  { value: "balcony", label: "Balcony" },
  { value: "other", label: "Other" },
];

export function AddManualRoomDialog({
  open,
  onOpenChange,
  drawingId,
  coordinates,
  onSuccess,
}: AddManualRoomDialogProps) {
  const [roomName, setRoomName] = useState("");
  const [roomType, setRoomType] = useState("bedroom");
  const [areaSqm, setAreaSqm] = useState("");

  const createRoom = useCreateRoom();

  const handleSave = () => {
    if (!roomName.trim()) return;

    createRoom.mutate(
      {
        drawingId,
        roomName: roomName.trim(),
        roomType,
        areaSqm: areaSqm ? parseFloat(areaSqm) : undefined,
        coordinates,
      },
      {
        onSuccess: () => {
          setRoomName("");
          setRoomType("bedroom");
          setAreaSqm("");
          onSuccess();
          onOpenChange(false);
        },
      }
    );
  };

  const handleCancel = () => {
    setRoomName("");
    setRoomType("bedroom");
    setAreaSqm("");
    onOpenChange(false);
  };

  const selectedColor = getRoomTypeColor(roomType);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Room Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="roomName">Room Name *</Label>
            <Input
              id="roomName"
              placeholder="e.g., Master Bedroom"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="roomType">Room Type</Label>
            <Select value={roomType} onValueChange={setRoomType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROOM_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded"
                        style={{ backgroundColor: getRoomTypeColor(type.value) }}
                      />
                      {type.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="areaSqm">Area (sqm) - Optional</Label>
            <Input
              id="areaSqm"
              type="number"
              placeholder="e.g., 25"
              value={areaSqm}
              onChange={(e) => setAreaSqm(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <div
              className="w-6 h-6 rounded"
              style={{ backgroundColor: selectedColor }}
            />
            <span className="text-sm text-muted-foreground">
              Room will be displayed with this color
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!roomName.trim() || createRoom.isPending}
          >
            {createRoom.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Room"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
