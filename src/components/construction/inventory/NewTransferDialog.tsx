import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useItemMaster, useLocations, useInventoryStock } from "@/hooks/construction/useConstructionInventory";
import { useCreateTransfer } from "@/hooks/construction/useCreateTransfer";
import { ITEM_CATEGORIES, type ItemCategory } from "@/types/construction-inventory";

interface NewTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewTransferDialog({ open, onOpenChange }: NewTransferDialogProps) {
  const [category, setCategory] = useState<ItemCategory | "">("");
  const [fromLocationId, setFromLocationId] = useState("");
  const [toLocationId, setToLocationId] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [quantity, setQuantity] = useState<number>(1);
  const [notes, setNotes] = useState("");

  // Fetch data
  const { data: allItems, isLoading: itemsLoading } = useItemMaster(category as ItemCategory | undefined);
  const { data: locations, isLoading: locationsLoading } = useLocations();
  const { data: stockData } = useInventoryStock();
  
  const createTransfer = useCreateTransfer();

  // Filter items by selected category
  const filteredItems = category 
    ? allItems?.filter(item => item.category === category) 
    : allItems;

  // Get available stock for selected item at from location
  const availableStock = stockData?.find(
    s => s.item_master_id === selectedItemId && s.location_id === fromLocationId
  )?.quantity || 0;

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setCategory("");
      setFromLocationId("");
      setToLocationId("");
      setSelectedItemId("");
      setQuantity(1);
      setNotes("");
    }
  }, [open]);

  // Reset item when category changes
  useEffect(() => {
    setSelectedItemId("");
  }, [category]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fromLocationId || !toLocationId || !selectedItemId || quantity <= 0) {
      return;
    }

    if (fromLocationId === toLocationId) {
      return;
    }

    await createTransfer.mutateAsync({
      fromLocationId,
      toLocationId,
      itemMasterId: selectedItemId,
      quantity,
      notes: notes || undefined,
    });

    onOpenChange(false);
  };

  const isFormValid = 
    fromLocationId && 
    toLocationId && 
    fromLocationId !== toLocationId &&
    selectedItemId && 
    quantity > 0 &&
    quantity <= availableStock;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-screen h-screen max-w-none max-h-none rounded-none p-6 overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Inventory Transfer</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select value={category} onValueChange={(val) => setCategory(val as ItemCategory)}>
              <SelectTrigger>
                <SelectValue placeholder="Select category..." />
              </SelectTrigger>
              <SelectContent>
                {ITEM_CATEGORIES.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* From Location */}
          <div className="space-y-2">
            <Label htmlFor="fromLocation">From Location</Label>
            <Select value={fromLocationId} onValueChange={setFromLocationId}>
              <SelectTrigger>
                <SelectValue placeholder="Select source location..." />
              </SelectTrigger>
              <SelectContent>
                {locationsLoading ? (
                  <div className="p-2 text-center text-muted-foreground">Loading...</div>
                ) : (
                  locations?.map(loc => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* To Location */}
          <div className="space-y-2">
            <Label htmlFor="toLocation">To Location</Label>
            <Select value={toLocationId} onValueChange={setToLocationId}>
              <SelectTrigger>
                <SelectValue placeholder="Select destination location..." />
              </SelectTrigger>
              <SelectContent>
                {locationsLoading ? (
                  <div className="p-2 text-center text-muted-foreground">Loading...</div>
                ) : (
                  locations?.filter(loc => loc.id !== fromLocationId).map(loc => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {fromLocationId === toLocationId && toLocationId && (
              <p className="text-sm text-destructive">Source and destination cannot be the same</p>
            )}
          </div>

          {/* Item */}
          <div className="space-y-2">
            <Label htmlFor="item">Item</Label>
            <Select 
              value={selectedItemId} 
              onValueChange={setSelectedItemId}
              disabled={!category}
            >
              <SelectTrigger>
                <SelectValue placeholder={category ? "Select item..." : "Select category first..."} />
              </SelectTrigger>
              <SelectContent>
                {itemsLoading ? (
                  <div className="p-2 text-center text-muted-foreground">Loading...</div>
                ) : filteredItems && filteredItems.length > 0 ? (
                  filteredItems.map(item => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.item_code} - {item.item_name}
                    </SelectItem>
                  ))
                ) : (
                  <div className="p-2 text-center text-muted-foreground">No items found</div>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <Label htmlFor="quantity">
              Quantity
              {selectedItemId && fromLocationId && (
                <span className="ml-2 text-muted-foreground font-normal">
                  (Available: {availableStock})
                </span>
              )}
            </Label>
            <Input
              id="quantity"
              type="number"
              min={1}
              max={availableStock || undefined}
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
            />
            {quantity > availableStock && availableStock > 0 && (
              <p className="text-sm text-destructive">
                Quantity exceeds available stock ({availableStock})
              </p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any transfer notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={createTransfer.isPending}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={!isFormValid || createTransfer.isPending}
            >
              {createTransfer.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Transfer
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
