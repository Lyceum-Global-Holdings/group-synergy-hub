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
import { Textarea } from "@/components/ui/textarea";
import { Upload, X } from "lucide-react";
import { useCreateFloorDrawing, uploadFloorDrawingImage } from "@/hooks/construction/useFloorDrawings";
import { useToast } from "@/hooks/use-toast";

interface AddFloorDrawingDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddFloorDrawingDialog({
  projectId,
  open,
  onOpenChange,
}: AddFloorDrawingDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [floorNumber, setFloorNumber] = useState(0);
  const [wallHeight, setWallHeight] = useState(3);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const createDrawing = useCreateFloorDrawing();
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.type.startsWith("image/")) {
        toast({
          title: "Invalid file",
          description: "Please select an image file",
          variant: "destructive",
        });
        return;
      }
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const clearFile = () => {
    setFile(null);
    setPreview(null);
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setFloorNumber(0);
    setWallHeight(3);
    setFile(null);
    setPreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !name) return;

    setIsUploading(true);
    try {
      const imageUrl = await uploadFloorDrawingImage(file, projectId);
      
      await createDrawing.mutateAsync({
        project_id: projectId,
        drawing_name: name,
        description: description || undefined,
        floor_number: floorNumber,
        wall_height: wallHeight,
        image_url: imageUrl,
      });

      resetForm();
      onOpenChange(false);
    } catch (error) {
      console.error("Error uploading floor drawing:", error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) resetForm();
      onOpenChange(open);
    }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Floor Drawing</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Drawing Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Ground Floor Plan"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="floor">Floor Number</Label>
              <Input
                id="floor"
                type="number"
                value={floorNumber}
                onChange={(e) => setFloorNumber(parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wallHeight">Wall Height (m)</Label>
              <Input
                id="wallHeight"
                type="number"
                step="0.1"
                min="1"
                max="10"
                value={wallHeight}
                onChange={(e) => setWallHeight(parseFloat(e.target.value) || 3)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Floor Plan Image *</Label>
            {preview ? (
              <div className="relative border rounded-lg p-2">
                <img
                  src={preview}
                  alt="Preview"
                  className="w-full h-40 object-contain rounded"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute top-1 right-1"
                  onClick={clearFile}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground">
                  Click to upload floor plan image
                </span>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileChange}
                />
              </label>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!file || !name || isUploading || createDrawing.isPending}
            >
              {isUploading ? "Uploading..." : "Add Drawing"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
