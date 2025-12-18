import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Scan, Trash2, Edit2, Check, X, Square } from "lucide-react";
import { FloorDrawing, FloorDrawingRoom } from "@/types/construction";
import { useFloorDrawingRooms, useDetectRooms, useDeleteRoom, useUpdateRoom } from "@/hooks/construction/useFloorRooms";
import { Floor2DRoomOverlay } from "./Floor2DRoomOverlay";

interface RoomDetectionDialogProps {
  drawing: FloorDrawing | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RoomDetectionDialog({ drawing, open, onOpenChange }: RoomDetectionDialogProps) {
  const [totalArea, setTotalArea] = useState<string>(drawing?.total_area_sqm?.toString() ?? "");
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  const { data: rooms = [], isLoading: roomsLoading } = useFloorDrawingRooms(drawing?.id || null);
  const detectRooms = useDetectRooms();
  const deleteRoom = useDeleteRoom();
  const updateRoom = useUpdateRoom();

  const handleDetectRooms = () => {
    if (!drawing) return;
    
    detectRooms.mutate({
      drawingId: drawing.id,
      imageUrl: drawing.image_url,
      totalAreaSqm: totalArea ? parseFloat(totalArea) : undefined,
    });
  };

  const handleStartEdit = (room: FloorDrawingRoom) => {
    setEditingRoomId(room.id);
    setEditingName(room.room_name);
  };

  const handleSaveEdit = () => {
    if (!editingRoomId) return;
    updateRoom.mutate({
      roomId: editingRoomId,
      updates: { room_name: editingName },
    });
    setEditingRoomId(null);
  };

  const handleCancelEdit = () => {
    setEditingRoomId(null);
    setEditingName("");
  };

  const totalAreaCalc = rooms.reduce((sum, room) => sum + (room.area_sqm || 0), 0);
  const totalAreaSqft = rooms.reduce((sum, room) => sum + (room.area_sqft || 0), 0);

  if (!drawing) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Square className="h-5 w-5" />
            Room Detection - {drawing.drawing_name}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Floor Plan with Overlays */}
          <div className="space-y-3">
            <div className="relative border rounded-lg overflow-hidden bg-muted">
              <Floor2DRoomOverlay
                imageUrl={drawing.image_url}
                rooms={rooms}
                selectedRoomId={selectedRoomId}
                onRoomClick={setSelectedRoomId}
              />
            </div>

            {/* Detection Controls */}
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Label htmlFor="totalArea" className="text-sm">
                  Total Floor Area (sqm) - Optional
                </Label>
                <Input
                  id="totalArea"
                  type="number"
                  placeholder="e.g., 150"
                  value={totalArea}
                  onChange={(e) => setTotalArea(e.target.value)}
                  className="mt-1"
                />
              </div>
              <Button 
                onClick={handleDetectRooms}
                disabled={detectRooms.isPending}
              >
                {detectRooms.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Scan className="h-4 w-4 mr-2" />
                    Detect Rooms
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Provide total area for accurate room area calculations. AI will analyze the floor plan and identify all rooms.
            </p>
          </div>

          {/* Room List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Detected Rooms ({rooms.length})</h3>
              {rooms.length > 0 && (
                <Badge variant="secondary">
                  Total: {totalAreaCalc.toFixed(1)} sqm / {totalAreaSqft.toFixed(1)} sqft
                </Badge>
              )}
            </div>

            <ScrollArea className="h-[400px] border rounded-lg">
              {roomsLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : rooms.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                  <Square className="h-8 w-8 mb-2" />
                  <p className="text-sm">No rooms detected yet</p>
                  <p className="text-xs">Click "Detect Rooms" to analyze the floor plan</p>
                </div>
              ) : (
                <div className="p-2 space-y-2">
                  {rooms.map((room) => (
                    <div
                      key={room.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedRoomId === room.id 
                          ? 'border-primary bg-primary/5' 
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => setSelectedRoomId(room.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-4 h-4 rounded" 
                            style={{ backgroundColor: room.color || '#6366F1' }}
                          />
                          {editingRoomId === room.id ? (
                            <div className="flex items-center gap-1">
                              <Input
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                className="h-7 w-32"
                                onClick={(e) => e.stopPropagation()}
                              />
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={(e) => { e.stopPropagation(); handleSaveEdit(); }}
                              >
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={(e) => { e.stopPropagation(); handleCancelEdit(); }}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <span className="font-medium text-sm">{room.room_name}</span>
                          )}
                        </div>
                        {editingRoomId !== room.id && (
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={(e) => { e.stopPropagation(); handleStartEdit(room); }}
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={(e) => { e.stopPropagation(); deleteRoom.mutate(room.id); }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {room.room_type}
                        </Badge>
                        {room.area_sqm && (
                          <span className="text-xs text-muted-foreground">
                            {room.area_sqm.toFixed(1)} sqm ({room.area_sqft?.toFixed(1)} sqft)
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
