import { useState, useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ITEM_SECTIONS, ITEM_STATUSES } from "@/types/construction-inventory";
import { useUpdateItemMaster } from "@/hooks/construction/useConstructionInventory";
import { Loader2 } from "lucide-react";

interface EditItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: {
    id: string;
    item_code: string;
    item_name: string;
    category: string;
    section: string;
    brand?: string | null;
    model?: string | null;
    unit_of_measurement: string;
    unit_cost?: number | null;
    description?: string | null;
    status: string;
    image_url?: string | null;
  } | null;
}

export function EditItemDialog({ open, onOpenChange, item }: EditItemDialogProps) {
  const updateItem = useUpdateItemMaster();
  
  const [formData, setFormData] = useState({
    item_code: "",
    item_name: "",
    section: "",
    brand: "",
    model: "",
    unit_of_measurement: "",
    unit_cost: "",
    description: "",
    status: "",
  });

  useEffect(() => {
    if (item) {
      setFormData({
        item_code: item.item_code || "",
        item_name: item.item_name || "",
        section: item.section || "",
        brand: item.brand || "",
        model: item.model || "",
        unit_of_measurement: item.unit_of_measurement || "",
        unit_cost: item.unit_cost?.toString() || "",
        description: item.description || "",
        status: item.status || "active",
      });
    }
  }, [item]);

  if (!item) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.item_code || !formData.item_name || !formData.section) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      await updateItem.mutateAsync({
        id: item.id,
        item_code: formData.item_code,
        item_name: formData.item_name,
        section: formData.section as any,
        brand: formData.brand || undefined,
        model: formData.model || undefined,
        unit_of_measurement: formData.unit_of_measurement || undefined,
        unit_cost: formData.unit_cost ? parseFloat(formData.unit_cost) : undefined,
        description: formData.description || undefined,
      });
      toast.success("Item updated successfully");
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to update item:", error);
      toast.error("Failed to update item");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Item</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="item_code">Item Code *</Label>
              <Input
                id="item_code"
                value={formData.item_code}
                onChange={(e) => setFormData({ ...formData, item_code: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item_name">Item Name *</Label>
              <Input
                id="item_name"
                value={formData.item_name}
                onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="section">Section *</Label>
              <Select
                value={formData.section}
                onValueChange={(value) => setFormData({ ...formData, section: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select section" />
                </SelectTrigger>
                <SelectContent>
                  {ITEM_SECTIONS.map(section => (
                    <SelectItem key={section.value} value={section.value}>
                      {section.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {ITEM_STATUSES.map(status => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="brand">Brand</Label>
              <Input
                id="brand"
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Input
                id="model"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="unit_of_measurement">Unit</Label>
              <Input
                id="unit_of_measurement"
                value={formData.unit_of_measurement}
                onChange={(e) => setFormData({ ...formData, unit_of_measurement: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit_cost">Unit Cost (₹)</Label>
              <Input
                id="unit_cost"
                type="number"
                value={formData.unit_cost}
                onChange={(e) => setFormData({ ...formData, unit_cost: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateItem.isPending}>
              {updateItem.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
