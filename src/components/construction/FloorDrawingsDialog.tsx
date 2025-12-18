import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Box, Image, Scan } from "lucide-react";
import { useFloorDrawings, useDeleteFloorDrawing } from "@/hooks/construction/useFloorDrawings";
import { ConstructionProject, FloorDrawing } from "@/types/construction";
import { AddFloorDrawingDialog } from "./AddFloorDrawingDialog";
import { FloorPlan3DDialog } from "./FloorPlan3DDialog";
import { RoomDetectionDialog } from "./RoomDetectionDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface FloorDrawingsDialogProps {
  project: ConstructionProject | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FloorDrawingsDialog({
  project,
  open,
  onOpenChange,
}: FloorDrawingsDialogProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [viewing3D, setViewing3D] = useState<FloorDrawing | null>(null);
  const [viewingImage, setViewingImage] = useState<FloorDrawing | null>(null);
  const [deletingDrawing, setDeletingDrawing] = useState<FloorDrawing | null>(null);
  const [detectingRooms, setDetectingRooms] = useState<FloorDrawing | null>(null);

  const { data: drawings = [], isLoading } = useFloorDrawings(project?.id);
  const deleteDrawing = useDeleteFloorDrawing();

  const handleDelete = async () => {
    if (deletingDrawing && project) {
      await deleteDrawing.mutateAsync({
        id: deletingDrawing.id,
        projectId: project.id,
      });
      setDeletingDrawing(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Floor Drawings - {project?.project_name}</span>
              <Button onClick={() => setAddDialogOpen(true)} size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Drawing
              </Button>
            </DialogTitle>
          </DialogHeader>

          <div className="mt-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : drawings.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No floor drawings uploaded yet. Add your first floor drawing to
                view it in 3D.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Preview</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Floor</TableHead>
                    <TableHead>Wall Height</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drawings.map((drawing) => (
                    <TableRow key={drawing.id}>
                      <TableCell>
                        <img
                          src={drawing.image_url}
                          alt={drawing.drawing_name}
                          className="h-12 w-12 object-cover rounded border"
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {drawing.drawing_name}
                      </TableCell>
                      <TableCell>Floor {drawing.floor_number}</TableCell>
                      <TableCell>{drawing.wall_height}m</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {drawing.description || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setViewingImage(drawing)}
                            title="View 2D"
                          >
                            <Image className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setViewing3D(drawing)}
                            title="View 3D"
                          >
                            <Box className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDetectingRooms(drawing)}
                            title="Detect Rooms"
                          >
                            <Scan className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeletingDrawing(drawing)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {project && (
        <AddFloorDrawingDialog
          projectId={project.id}
          open={addDialogOpen}
          onOpenChange={setAddDialogOpen}
        />
      )}

      <FloorPlan3DDialog
        drawing={viewing3D}
        open={!!viewing3D}
        onOpenChange={(open) => !open && setViewing3D(null)}
      />

      <RoomDetectionDialog
        drawing={detectingRooms}
        open={!!detectingRooms}
        onOpenChange={(open) => !open && setDetectingRooms(null)}
      />

      {/* 2D Image Viewer */}
      <Dialog open={!!viewingImage} onOpenChange={(open) => !open && setViewingImage(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{viewingImage?.drawing_name} - 2D View</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center p-4">
            <img
              src={viewingImage?.image_url}
              alt={viewingImage?.drawing_name}
              className="max-w-full max-h-[60vh] object-contain rounded"
            />
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deletingDrawing}
        onOpenChange={(open) => !open && setDeletingDrawing(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Floor Drawing</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingDrawing?.drawing_name}"?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
