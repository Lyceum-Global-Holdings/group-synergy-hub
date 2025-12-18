import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FloorDrawing } from "@/types/construction";
import { FloorPlan3DViewer } from "./FloorPlan3DViewer";
import { Badge } from "@/components/ui/badge";

interface FloorPlan3DDialogProps {
  drawing: FloorDrawing | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FloorPlan3DDialog({
  drawing,
  open,
  onOpenChange,
}: FloorPlan3DDialogProps) {
  if (!drawing) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>{drawing.drawing_name} - 3D View</span>
            <Badge variant="outline">Floor {drawing.floor_number}</Badge>
            <Badge variant="secondary">Wall Height: {drawing.wall_height}m</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="h-[600px]">
          <FloorPlan3DViewer drawing={drawing} />
        </div>

        <div className="text-sm text-muted-foreground text-center">
          Use mouse to rotate (drag), pan (right-click drag), and zoom (scroll)
        </div>
      </DialogContent>
    </Dialog>
  );
}
