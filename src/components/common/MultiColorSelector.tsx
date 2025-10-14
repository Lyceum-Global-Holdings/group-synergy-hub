import { useState } from "react";
import { Check, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProductColor } from "@/types/productMaster";
import { useProductColors } from "@/hooks/useProductColors";

interface MultiColorSelectorProps {
  selectedColors: string[];
  onColorsChange: (colors: string[]) => void;
  showAddNew?: boolean;
}

export function MultiColorSelector({
  selectedColors,
  onColorsChange,
  showAddNew = true,
}: MultiColorSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newColorName, setNewColorName] = useState("");
  const { colors, createColor, isCreating } = useProductColors();

  const handleToggleColor = (colorName: string) => {
    if (selectedColors.includes(colorName)) {
      onColorsChange(selectedColors.filter((c) => c !== colorName));
    } else {
      onColorsChange([...selectedColors, colorName]);
    }
  };

  const handleAddNewColor = () => {
    if (newColorName.trim()) {
      createColor(newColorName.trim());
      setNewColorName("");
      setIsAdding(false);
    }
  };

  return (
    <div className="space-y-2">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-start">
            {selectedColors.length === 0 ? (
              <span className="text-muted-foreground">Select colors</span>
            ) : (
              <span>
                {selectedColors.length} color{selectedColors.length > 1 ? 's' : ''} selected
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <div className="p-4 border-b">
            <h4 className="font-medium text-sm mb-2">Select Colors</h4>
            {showAddNew && !isAdding && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-primary"
                onClick={() => setIsAdding(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add New Color
              </Button>
            )}
            {isAdding && (
              <div className="flex gap-2 mt-2">
                <Input
                  placeholder="Color name"
                  value={newColorName}
                  onChange={(e) => setNewColorName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddNewColor()}
                />
                <Button
                  size="sm"
                  onClick={handleAddNewColor}
                  disabled={isCreating || !newColorName.trim()}
                >
                  Add
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setIsAdding(false);
                    setNewColorName("");
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
          <ScrollArea className="h-64">
            <div className="p-2">
              {colors.map((color) => (
                <Button
                  key={color.id}
                  variant="ghost"
                  className="w-full justify-between"
                  onClick={() => handleToggleColor(color.color_name)}
                >
                  <div className="flex items-center gap-2">
                    {color.hex_value && (
                      <div
                        className="w-4 h-4 rounded border"
                        style={{ backgroundColor: color.hex_value }}
                      />
                    )}
                    <span>{color.color_name}</span>
                  </div>
                  {selectedColors.includes(color.color_name) && (
                    <Check className="h-4 w-4" />
                  )}
                </Button>
              ))}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {selectedColors.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedColors.map((colorName) => (
            <Badge key={colorName} variant="secondary">
              {colorName}
              <X
                className="h-3 w-3 ml-1 cursor-pointer"
                onClick={() => handleToggleColor(colorName)}
              />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
