import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProductColors } from "@/hooks/useProductColors";
import { useCompany } from "@/contexts/CompanyContext";

interface ColorMasterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onColorCreated?: () => void;
}

export function ColorMasterDialog({ open, onOpenChange, onColorCreated }: ColorMasterDialogProps) {
  const [colorName, setColorName] = useState("");
  const [colorCode, setColorCode] = useState("#000000");
  const { selectedCompany } = useCompany();
  const { createColor, isCreating } = useProductColors(selectedCompany?.id);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!colorName.trim()) {
      return;
    }

    createColor(
      {
        color_name: colorName.trim(),
        color_code: colorCode,
        company_id: selectedCompany?.id,
      },
      {
        onSuccess: () => {
          setColorName("");
          setColorCode("#000000");
          onColorCreated?.();
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Color</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="colorName">Color Name</Label>
            <Input
              id="colorName"
              value={colorName}
              onChange={(e) => setColorName(e.target.value)}
              placeholder="e.g., Navy Blue"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="colorCode">Color Code</Label>
            <div className="flex gap-2">
              <Input
                id="colorCode"
                type="color"
                value={colorCode}
                onChange={(e) => setColorCode(e.target.value)}
                className="w-20 h-10"
              />
              <Input
                value={colorCode}
                onChange={(e) => setColorCode(e.target.value)}
                placeholder="#000000"
                className="flex-1"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? "Adding..." : "Add Color"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
