import { useState, useEffect, useMemo } from "react";
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
import { Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useItemMaster, useSerialNumbers, useLocations, useInventoryStock } from "@/hooks/construction/useConstructionInventory";
import { useCreateTransfer } from "@/hooks/construction/useCreateTransfer";
import { ITEM_CATEGORIES, type ItemCategory, type ConstructionSerialNumber, type ConstructionItemMaster } from "@/types/construction-inventory";

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
  const [selectedSerialIds, setSelectedSerialIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  // Fetch data
  const { data: allItems, isLoading: itemsLoading } = useItemMaster(category as ItemCategory | undefined);
  const { data: locations, isLoading: locationsLoading } = useLocations();
  const { data: allSerials, isLoading: serialsLoading } = useSerialNumbers();
  const { data: stockData } = useInventoryStock();
  
  const createTransfer = useCreateTransfer();

  // Check if selected category is serial-tracked (machines)
  const isSerialTracked = category === "machines";

  // Get serial numbers available at the selected from location
  const serialsAtLocation = useMemo(() => {
    if (!fromLocationId || !allSerials) return [];
    return allSerials.filter(
      s => s.current_location_id === fromLocationId && s.availability === "available"
    );
  }, [allSerials, fromLocationId]);

  // Get unique item master IDs that have available serials at the location (for machines)
  const itemsWithSerialsAtLocation = useMemo(() => {
    if (!isSerialTracked || !serialsAtLocation.length) return [];
    const itemIds = new Set(serialsAtLocation.map(s => s.item_master_id));
    return allItems?.filter(item => itemIds.has(item.id)) || [];
  }, [isSerialTracked, serialsAtLocation, allItems]);

  // For non-serial items, filter by stock at location
  const itemsWithStockAtLocation = useMemo(() => {
    if (isSerialTracked || !fromLocationId || !stockData || !allItems) return [];
    const stockAtLocation = stockData.filter(s => s.location_id === fromLocationId && s.quantity > 0);
    const itemIds = new Set(stockAtLocation.map(s => s.item_master_id));
    return allItems.filter(item => itemIds.has(item.id));
  }, [isSerialTracked, fromLocationId, stockData, allItems]);

  // Combined filtered items for dropdown
  const filteredItems = useMemo(() => {
    if (!category || !fromLocationId) return [];
    return isSerialTracked ? itemsWithSerialsAtLocation : itemsWithStockAtLocation;
  }, [category, fromLocationId, isSerialTracked, itemsWithSerialsAtLocation, itemsWithStockAtLocation]);

  // Get available serial numbers for the selected item at the from location
  const availableSerialsForItem = useMemo(() => {
    if (!selectedItemId || !isSerialTracked) return [];
    return serialsAtLocation.filter(s => s.item_master_id === selectedItemId);
  }, [selectedItemId, isSerialTracked, serialsAtLocation]);

  // For non-serial items, get available stock quantity
  const availableStockQuantity = useMemo(() => {
    if (isSerialTracked || !selectedItemId || !fromLocationId || !stockData) return 0;
    const stock = stockData.find(
      s => s.item_master_id === selectedItemId && s.location_id === fromLocationId
    );
    return stock?.quantity || 0;
  }, [isSerialTracked, selectedItemId, fromLocationId, stockData]);

  // Actual available count for display
  const availableCount = isSerialTracked ? availableSerialsForItem.length : availableStockQuantity;

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setCategory("");
      setFromLocationId("");
      setToLocationId("");
      setSelectedItemId("");
      setQuantity(1);
      setSelectedSerialIds([]);
      setNotes("");
    }
  }, [open]);

  // Reset downstream selections when category changes
  useEffect(() => {
    setSelectedItemId("");
    setQuantity(1);
    setSelectedSerialIds([]);
  }, [category]);

  // Reset item selection when from location changes
  useEffect(() => {
    setSelectedItemId("");
    setQuantity(1);
    setSelectedSerialIds([]);
  }, [fromLocationId]);

  // Reset serial selections when item or quantity changes
  useEffect(() => {
    setSelectedSerialIds([]);
  }, [selectedItemId, quantity]);

  // Handle serial selection for a specific slot
  const handleSerialSelect = (index: number, serialId: string) => {
    const newSelections = [...selectedSerialIds];
    newSelections[index] = serialId;
    setSelectedSerialIds(newSelections);
  };

  // Get serials that haven't been selected yet (for preventing duplicates)
  const getAvailableSerialsForSlot = (slotIndex: number) => {
    const selectedInOtherSlots = selectedSerialIds.filter((_, i) => i !== slotIndex);
    return availableSerialsForItem.filter(s => !selectedInOtherSlots.includes(s.id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fromLocationId || !toLocationId || !selectedItemId || quantity <= 0) {
      return;
    }

    if (fromLocationId === toLocationId) {
      return;
    }

    // For serial-tracked items, ensure all serials are selected
    if (isSerialTracked) {
      if (selectedSerialIds.length !== quantity || selectedSerialIds.some(id => !id)) {
        return;
      }
    }

    await createTransfer.mutateAsync({
      fromLocationId,
      toLocationId,
      itemMasterId: selectedItemId,
      quantity,
      serialNumberIds: isSerialTracked ? selectedSerialIds : undefined,
      notes: notes || undefined,
    });

    onOpenChange(false);
  };

  // Form validation
  const isFormValid = useMemo(() => {
    const baseValid = 
      fromLocationId && 
      toLocationId && 
      fromLocationId !== toLocationId &&
      selectedItemId && 
      quantity > 0 &&
      quantity <= availableCount;
    
    if (isSerialTracked) {
      return baseValid && 
        selectedSerialIds.length === quantity && 
        selectedSerialIds.every(id => id);
    }
    
    return baseValid;
  }, [fromLocationId, toLocationId, selectedItemId, quantity, availableCount, isSerialTracked, selectedSerialIds]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-screen h-screen max-w-none max-h-none rounded-none p-6 overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Inventory Transfer</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
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
            <Select value={fromLocationId} onValueChange={setFromLocationId} disabled={!category}>
              <SelectTrigger>
                <SelectValue placeholder={category ? "Select source location..." : "Select category first..."} />
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
            <Select value={toLocationId} onValueChange={setToLocationId} disabled={!fromLocationId}>
              <SelectTrigger>
                <SelectValue placeholder={fromLocationId ? "Select destination location..." : "Select source first..."} />
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

          {/* Item - Only show items that exist at From Location */}
          <div className="space-y-2">
            <Label htmlFor="item">
              Item
              {fromLocationId && category && (
                <span className="ml-2 text-muted-foreground font-normal text-xs">
                  ({filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''} available at this location)
                </span>
              )}
            </Label>
            <Select 
              value={selectedItemId} 
              onValueChange={setSelectedItemId}
              disabled={!category || !fromLocationId}
            >
              <SelectTrigger>
                <SelectValue placeholder={
                  !category ? "Select category first..." : 
                  !fromLocationId ? "Select source location first..." :
                  "Select item..."
                } />
              </SelectTrigger>
              <SelectContent>
                {itemsLoading || serialsLoading ? (
                  <div className="p-2 text-center text-muted-foreground">Loading...</div>
                ) : filteredItems.length > 0 ? (
                  filteredItems.map(item => {
                    // Show count for each item
                    const itemCount = isSerialTracked 
                      ? serialsAtLocation.filter(s => s.item_master_id === item.id).length
                      : stockData?.find(s => s.item_master_id === item.id && s.location_id === fromLocationId)?.quantity || 0;
                    return (
                      <SelectItem key={item.id} value={item.id}>
                        {item.item_code} - {item.item_name} ({itemCount} available)
                      </SelectItem>
                    );
                  })
                ) : (
                  <div className="p-2 text-center text-muted-foreground">
                    No {category} items found at this location
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Quantity */}
          {selectedItemId && (
            <div className="space-y-2">
              <Label htmlFor="quantity">
                Quantity
                <span className="ml-2 text-muted-foreground font-normal">
                  (Available: {availableCount})
                </span>
              </Label>
              <Input
                id="quantity"
                type="number"
                min={1}
                max={availableCount || 1}
                value={quantity}
                onChange={(e) => setQuantity(Math.min(parseInt(e.target.value) || 1, availableCount))}
              />
              {quantity > availableCount && (
                <p className="text-sm text-destructive">
                  Quantity exceeds available stock ({availableCount})
                </p>
              )}
            </div>
          )}

          {/* Serial Number Selection (for machines) - Only show after quantity is set */}
          {isSerialTracked && selectedItemId && quantity > 0 && quantity <= availableCount && (
            <div className="space-y-3">
              <Label>
                Select Machines
                <span className="ml-2 text-muted-foreground font-normal">
                  (Select {quantity} machine{quantity !== 1 ? 's' : ''})
                </span>
              </Label>
              
              {Array.from({ length: quantity }).map((_, index) => (
                <div key={index} className="space-y-1">
                  <Label className="text-sm text-muted-foreground">Machine {index + 1}</Label>
                  <Select
                    value={selectedSerialIds[index] || ""}
                    onValueChange={(value) => handleSerialSelect(index, value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select machine by serial number..." />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableSerialsForSlot(index).map(serial => (
                        <SelectItem key={serial.id} value={serial.id}>
                          {serial.serial_number} - {serial.item_master?.item_name || "Unknown"} ({serial.condition})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}

              {selectedSerialIds.length > 0 && selectedSerialIds.some(id => !id) && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Please select all {quantity} machine{quantity !== 1 ? 's' : ''} before submitting.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

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
