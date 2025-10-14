import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";
import { useProductColors } from "@/hooks/useProductColors";
import { useCompany } from "@/contexts/CompanyContext";
import { ColorMasterDialog } from "./ColorMasterDialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface MultiColorSelectorProps {
  selectedColors: any[];
  onColorsChange: (colors: any[]) => void;
}

export function MultiColorSelector({ selectedColors, onColorsChange }: MultiColorSelectorProps) {
  const [colorDialogOpen, setColorDialogOpen] = useState(false);
  const { selectedCompany } = useCompany();
  const { colors, isLoading } = useProductColors(selectedCompany?.id);

  const handleToggleColor = (color: any) => {
    const isSelected = selectedColors.some(c => c.id === color.id);
    if (isSelected) {
      onColorsChange(selectedColors.filter(c => c.id !== color.id));
    } else {
      onColorsChange([...selectedColors, color]);
    }
  };

  const handleRemoveColor = (colorId: string) => {
    onColorsChange(selectedColors.filter(c => c.id !== colorId));
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-center">
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" className="w-full justify-start">
              Select Colors ({selectedColors.length} selected)
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 max-h-[300px] overflow-y-auto">
            <div className="space-y-2">
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading colors...</p>
              ) : colors && colors.length > 0 ? (
                colors.map((color) => (
                  <div key={color.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`color-${color.id}`}
                      checked={selectedColors.some(c => c.id === color.id)}
                      onCheckedChange={() => handleToggleColor(color)}
                    />
                    <Label
                      htmlFor={`color-${color.id}`}
                      className="flex items-center gap-2 cursor-pointer flex-1"
                    >
                      <div
                        className="w-4 h-4 rounded border"
                        style={{ backgroundColor: color.color_code }}
                      />
                      <span>{color.color_name}</span>
                    </Label>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No colors available</p>
              )}
            </div>
          </PopoverContent>
        </Popover>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setColorDialogOpen(true)}
          title="Add new color"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {selectedColors.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedColors.map((color) => (
            <Badge key={color.id} variant="secondary" className="gap-2">
              <div
                className="w-3 h-3 rounded border"
                style={{ backgroundColor: color.color_code }}
              />
              {color.color_name}
              <button
                type="button"
                onClick={() => handleRemoveColor(color.id)}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <ColorMasterDialog
        open={colorDialogOpen}
        onOpenChange={setColorDialogOpen}
      />
    </div>
  );
}
