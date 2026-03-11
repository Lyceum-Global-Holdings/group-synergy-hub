import { useState, useEffect, useMemo, useRef } from "react";
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
import { ITEM_CATEGORIES, type ItemCategory } from "@/types/construction-inventory";
import { useCompany } from "@/contexts/CompanyContext";
import { useCurrentUserLocationPermissions } from "@/hooks/useCurrentUserLocationPermissions";
import { toast } from "sonner";

interface NewTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewTransferDialog({ open, onOpenChange }: NewTransferDialogProps) {
  const [category, setCategory] = useState<ItemCategory | "">("");
  const [fromLocationId, setFromLocationId] = useState("");
  const [toLocationId, setToLocationId] = useState("");
  const [selectedItemMasterId, setSelectedItemMasterId] = useState("");
  const [quantity, setQuantity] = useState<number>(0);
  const [selectedSerialIds, setSelectedSerialIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const isSubmittingRef = useRef(false);

  // Get company context
  const { selectedCompany } = useCompany();

  // Fetch data
  const { data: allItems, isLoading: itemsLoading } = useItemMaster(category as ItemCategory | undefined);
  const { data: allLocations, isLoading: locationsLoading } = useLocations();
  const { data: allSerials, isLoading: serialsLoading } = useSerialNumbers();
  const { data: stockData } = useInventoryStock();
  const { data: permissions } = useCurrentUserLocationPermissions();

  // Filter locations by user permissions (edit access required for source/from transfers)
  // IMPORTANT: Always filter by editLocationIds regardless of viewAllLocations flag.
  // viewAllLocations only grants VIEW access, not EDIT access for transfers.
  const permittedLocations = useMemo(() => {
    if (!allLocations || !permissions) return [];
    const permittedIds = new Set([...permissions.editLocationIds]);
    return allLocations.filter(loc => permittedIds.has(loc.id));
  }, [allLocations, permissions]);
  
  const createTransfer = useCreateTransfer();

  // Check if selected category is serial-tracked (machines)
  const isSerialTracked = category === "machines";

  // Get items available at the selected from location for non-serial categories
  const itemsAtFromLocation = useMemo(() => {
    if (!fromLocationId || !category || isSerialTracked || !stockData || !allItems) return [];
    const categoryItems = allItems.filter(i => i.category === category);
    const categoryItemIds = new Set(categoryItems.map(i => i.id));
    const stockAtLocation = stockData.filter(
      s => s.location_id === fromLocationId && categoryItemIds.has(s.item_master_id) && (s.quantity || 0) > 0
    );
    return stockAtLocation.map(s => {
      const item = categoryItems.find(i => i.id === s.item_master_id);
      return { stockId: s.id, itemMasterId: s.item_master_id, itemName: item?.item_name || "Unknown", itemCode: item?.item_code || "", available: s.quantity || 0 };
    });
  }, [fromLocationId, category, isSerialTracked, stockData, allItems]);

  // Get serial numbers available at the selected from location for this category
  const serialsAtLocation = useMemo(() => {
    if (!fromLocationId || !allSerials || !category) return [];
    return allSerials.filter(
      s => s.current_location_id === fromLocationId && 
           s.availability === "available" &&
           s.condition !== "under_repair" &&
           s.item_master?.category === category
    );
  }, [allSerials, fromLocationId, category]);

  // Get total available count at the from location
  const totalAvailableAtLocation = useMemo(() => {
    if (!fromLocationId || !category) return 0;
    
    if (isSerialTracked) {
      return serialsAtLocation.length;
    } else {
      // For non-serial: available quantity of the selected item
      if (selectedItemMasterId) {
        const found = itemsAtFromLocation.find(i => i.itemMasterId === selectedItemMasterId);
        return found?.available || 0;
      }
      return 0;
    }
  }, [fromLocationId, category, isSerialTracked, serialsAtLocation, selectedItemMasterId, itemsAtFromLocation]);

  // Get available serials for selection (exclude already selected ones)
  const getAvailableSerialsForSlot = (slotIndex: number) => {
    const selectedInOtherSlots = selectedSerialIds.filter((_, i) => i !== slotIndex);
    return serialsAtLocation.filter(s => !selectedInOtherSlots.includes(s.id));
  };

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setCategory("");
      setFromLocationId("");
      setToLocationId("");
      setSelectedItemMasterId("");
      setQuantity(0);
      setSelectedSerialIds([]);
      setNotes("");
    }
  }, [open]);

  // Reset downstream selections when category changes
  useEffect(() => {
    setFromLocationId("");
    setToLocationId("");
    setSelectedItemMasterId("");
    setQuantity(0);
    setSelectedSerialIds([]);
  }, [category]);

  // Reset quantity and selections when from location changes
  useEffect(() => {
    setSelectedItemMasterId("");
    setQuantity(0);
    setSelectedSerialIds([]);
  }, [fromLocationId]);

  // Reset to location when from location changes (to prevent same location)
  useEffect(() => {
    if (fromLocationId && toLocationId === fromLocationId) {
      setToLocationId("");
    }
  }, [fromLocationId, toLocationId]);

  // Reset serial selections when quantity changes
  useEffect(() => {
    setSelectedSerialIds([]);
  }, [quantity]);

  // Handle serial selection for a specific slot
  const handleSerialSelect = (index: number, serialId: string) => {
    const newSelections = [...selectedSerialIds];
    newSelections[index] = serialId;
    setSelectedSerialIds(newSelections);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Strict double submission prevention - check ref first
    if (isSubmittingRef.current) {
      console.log("Blocked: already submitting (ref)");
      return;
    }

    // Then check mutation state
    if (createTransfer.isPending) {
      console.log("Blocked: mutation pending");
      return;
    }

    // Set flag immediately before any async work
    isSubmittingRef.current = true;

    // Check company selection
    if (!selectedCompany?.id) {
      toast.error("Please select a company before creating a transfer");
      isSubmittingRef.current = false;
      return;
    }

    if (!fromLocationId || !toLocationId || quantity <= 0) {
      isSubmittingRef.current = false;
      return;
    }

    if (fromLocationId === toLocationId) {
      isSubmittingRef.current = false;
      return;
    }

    // For serial-tracked items, ensure all serials are selected
    if (isSerialTracked) {
      if (selectedSerialIds.length !== quantity || selectedSerialIds.some(id => !id)) {
        isSubmittingRef.current = false;
        return;
      }
      
      // Get the first selected serial to determine item_master_id
      const firstSerial = serialsAtLocation.find(s => s.id === selectedSerialIds[0]);
      if (!firstSerial) {
        isSubmittingRef.current = false;
        return;
      }

      try {
        await createTransfer.mutateAsync({
          fromLocationId,
          toLocationId,
          itemMasterId: firstSerial.item_master_id,
          quantity,
          serialNumberIds: selectedSerialIds,
          notes: notes || undefined,
        });
        onOpenChange(false);
      } catch (error) {
        // Error already handled by mutation onError
      } finally {
        isSubmittingRef.current = false;
      }
    } else {
      // For non-serial items (bulk quantity transfer)
      if (!selectedItemMasterId) {
        toast.error("Please select an item to transfer");
        isSubmittingRef.current = false;
        return;
      }

      try {
        await createTransfer.mutateAsync({
          fromLocationId,
          toLocationId,
          itemMasterId: selectedItemMasterId,
          quantity,
          notes: notes || undefined,
        });
        onOpenChange(false);
      } catch (error) {
        // Error already handled by mutation onError
      } finally {
        isSubmittingRef.current = false;
      }
    }
  };

  // Form validation - include company check
  const isFormValid = useMemo(() => {
    // Must have a company selected
    if (!selectedCompany?.id) return false;
    
    const baseValid = 
      fromLocationId && 
      toLocationId && 
      fromLocationId !== toLocationId &&
      quantity > 0 &&
      quantity <= totalAvailableAtLocation;
    
    if (isSerialTracked) {
      return baseValid && 
        selectedSerialIds.length === quantity && 
        selectedSerialIds.every(id => id);
    }
    
    return baseValid;
  }, [selectedCompany, fromLocationId, toLocationId, quantity, totalAvailableAtLocation, isSerialTracked, selectedSerialIds]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Inventory Transfer</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
          {/* Company Selection Warning */}
          {!selectedCompany?.id && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Please select a specific company before creating a transfer. You are currently viewing "All Companies".
              </AlertDescription>
            </Alert>
          )}

          {/* 1. Category */}
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

          {/* 2. From Location */}
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
                  permittedLocations?.map(loc => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* 3. To Location */}
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
                  allLocations?.filter(loc => loc.id !== fromLocationId).map(loc => (
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

          {/* 4. Quantity - Show available items in brackets */}
          {toLocationId && (
            <div className="space-y-2">
              <Label htmlFor="quantity">
                Quantity
                <span className="ml-2 text-muted-foreground font-normal">
                  (Available: {totalAvailableAtLocation})
                </span>
              </Label>
              <Input
                id="quantity"
                type="number"
                min={1}
                max={totalAvailableAtLocation || 1}
                value={quantity || ""}
                placeholder="Enter quantity to transfer..."
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  setQuantity(Math.min(val, totalAvailableAtLocation));
                }}
              />
              {quantity > totalAvailableAtLocation && totalAvailableAtLocation > 0 && (
                <p className="text-sm text-destructive">
                  Quantity exceeds available items ({totalAvailableAtLocation})
                </p>
              )}
              {totalAvailableAtLocation === 0 && (
                <p className="text-sm text-destructive">
                  No {category} items available at this location
                </p>
              )}
            </div>
          )}

          {/* 5. Item Selection - Multiple fields based on quantity (for machines/serial-tracked) */}
          {isSerialTracked && quantity > 0 && quantity <= totalAvailableAtLocation && (
            <div className="space-y-3">
              <Label>
                Select Items
                <span className="ml-2 text-muted-foreground font-normal">
                  (Select {quantity} item{quantity !== 1 ? 's' : ''})
                </span>
              </Label>
              
              {Array.from({ length: quantity }).map((_, index) => (
                <div key={index} className="space-y-1">
                  <Label className="text-sm text-muted-foreground">Item {index + 1}</Label>
                  <Select
                    value={selectedSerialIds[index] || ""}
                    onValueChange={(value) => handleSerialSelect(index, value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select item..." />
                    </SelectTrigger>
                    <SelectContent>
                      {serialsLoading || itemsLoading ? (
                        <div className="p-2 text-center text-muted-foreground">Loading...</div>
                      ) : (
                        getAvailableSerialsForSlot(index).map(serial => (
                          <SelectItem key={serial.id} value={serial.id}>
                            {serial.item_master?.item_code || "N/A"} - {serial.item_master?.item_name || "Unknown"} | S/N: {serial.serial_number} ({serial.condition})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              ))}

              {quantity > 0 && selectedSerialIds.filter(Boolean).length < quantity && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Please select all {quantity} item{quantity !== 1 ? 's' : ''} to continue.
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
