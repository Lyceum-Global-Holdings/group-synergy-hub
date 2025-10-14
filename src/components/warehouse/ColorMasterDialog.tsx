import { useState } from "react";
import { Plus, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useProductColors } from "@/hooks/useProductColors";

interface ColorMasterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ColorMasterDialog({ open, onOpenChange }: ColorMasterDialogProps) {
  const [colorName, setColorName] = useState("");
  const [hexValue, setHexValue] = useState("#000000");
  const { colors, createColor, isCreating } = useProductColors();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (colorName.trim()) {
      createColor(colorName.trim());
      setColorName("");
      setHexValue("#000000");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Color Master
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="color_name">Color Name *</Label>
                <Input
                  id="color_name"
                  value={colorName}
                  onChange={(e) => setColorName(e.target.value)}
                  placeholder="e.g., Navy Blue"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hex_value">Color Preview</Label>
                <div className="flex gap-2">
                  <Input
                    id="hex_value"
                    type="color"
                    value={hexValue}
                    onChange={(e) => setHexValue(e.target.value)}
                    className="w-20 h-10"
                  />
                  <Input
                    value={hexValue}
                    onChange={(e) => setHexValue(e.target.value)}
                    placeholder="#000000"
                  />
                </div>
              </div>
            </div>
            <Button type="submit" disabled={isCreating} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Add Color
            </Button>
          </form>

          <div className="border rounded-lg mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Preview</TableHead>
                  <TableHead>Color Name</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {colors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No colors yet. Add your first color above.
                    </TableCell>
                  </TableRow>
                ) : (
                  colors.map((color) => (
                    <TableRow key={color.id}>
                      <TableCell>
                        <div
                          className="w-8 h-8 rounded border"
                          style={{
                            backgroundColor: color.hex_value || '#cccccc',
                          }}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{color.color_name}</TableCell>
                      <TableCell>
                        <Badge variant={color.is_active ? "default" : "secondary"}>
                          {color.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
