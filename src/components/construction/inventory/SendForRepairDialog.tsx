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
import { useItemMaster, useSerialNumbers, useLocations } from "@/hooks/construction/useConstructionInventory";
import { useSendForRepair } from "@/hooks/construction/useSendForRepair";
import { ITEM_CATEGORIES, type ItemCategory } from "@/types/construction-inventory";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";

interface SendForRepairDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SendForRepairDialog({ open, onOpenChange }: SendForRepairDialogProps) {
  const [category, setCategory] = useState<ItemCategory | "">("");
  const [locationId, setLocationId] = useState("");
  const [repairCentre, setRepairCentre] = useState("");
  const [quantity, setQuantity] = useState<number>(0);
  const [selectedSerialIds, setSelectedSerialIds] = useState<string[]>([]);
  const [issueDescription, setIssueDescription] = useState("");
  const [notes, setNotes] = useState("");
  const isSubmittingRef = useRef(false);

  // Get company context
  const { selectedCompany } = useCompany();

  // Fetch data
  const { data: allItems, isLoading: itemsLoading } = useItemMaster(category as ItemCategory | undefined);
  const { data: locations, isLoading: locationsLoading } = useLocations();
  const { data: allSerials, isLoading: serialsLoading } = useSerialNumbers();
  
  const sendForRepair = useSendForRepair();

  // Check if selected category is serial-tracked (machines)
  const isSerialTracked = category === "machines";

  // Get serial numbers available at the selected location for the selected category
  const serialsAtLocation = useMemo(() => {
    if (!locationId || !allSerials || !category) return [];
    
    // Filter serials by location and availability
    return allSerials.filter(s => {
      // Must be at this location
      if (s.current_location_id !== locationId) return false;
      // Must be available (not already in repair or in transit)
      if (s.availability !== "available") return false;
      // Must not be under_repair condition
      if (s.condition === "under_repair") return false;
      // Must match selected category
      if (s.item_master?.category !== category) return false;
      return true;
    });
  }, [allSerials, locationId, category]);

  // Get total available count at the location for selected category
  const totalAvailableAtLocation = useMemo(() => {
    if (!locationId || !category) return 0;
    
    if (isSerialTracked) {
      // For machines: count available serial numbers at this location for this category
      return serialsAtLocation.length;
    } else {
      // For non-serial items: we don't support bulk repairs for now
      return 0;
    }
  }, [locationId, category, isSerialTracked, serialsAtLocation]);

  // Get available serials for selection (exclude already selected ones)
  const getAvailableSerialsForSlot = (slotIndex: number) => {
    const selectedInOtherSlots = selectedSerialIds.filter((_, i) => i !== slotIndex);
    return serialsAtLocation.filter(s => !selectedInOtherSlots.includes(s.id));
  };

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setCategory("");
      setLocationId("");
      setRepairCentre("");
      setQuantity(0);
      setSelectedSerialIds([]);
      setIssueDescription("");
      setNotes("");
    }
  }, [open]);

  // Reset downstream selections when category changes
  useEffect(() => {
    setLocationId("");
    setQuantity(0);
    setSelectedSerialIds([]);
  }, [category]);

  // Reset quantity and selections when location changes
  useEffect(() => {
    setQuantity(0);
    setSelectedSerialIds([]);
  }, [locationId]);

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
    if (sendForRepair.isPending) {
      console.log("Blocked: mutation pending");
      return;
    }

    // Set flag immediately before any async work
    isSubmittingRef.current = true;

    // Check company selection
    if (!selectedCompany?.id) {
      toast.error("Please select a company before sending items for repair");
      isSubmittingRef.current = false;
      return;
    }

    if (!locationId || !repairCentre || quantity <= 0) {
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
        await sendForRepair.mutateAsync({
          locationId,
          repairCentre,
          itemMasterId: firstSerial.item_master_id,
          quantity,
          serialNumberIds: selectedSerialIds,
          issueDescription: issueDescription || undefined,
          notes: notes || undefined,
        });
        onOpenChange(false);
      } catch (error) {
        // Error already handled by mutation onError
      } finally {
        isSubmittingRef.current = false;
      }
    } else {
      // For non-serial items, we don't support bulk repairs for now
      isSubmittingRef.current = false;
      return;
    }
  };

  // Form validation - include company check
  const isFormValid = useMemo(() => {
    // Must have a company selected
    if (!selectedCompany?.id) return false;
    
    const baseValid = 
      locationId && 
      repairCentre.trim() !== "" &&
      quantity > 0 &&
      quantity <= totalAvailableAtLocation;
    
    if (isSerialTracked) {
      return baseValid && 
        selectedSerialIds.length === quantity && 
        selectedSerialIds.every(id => id);
    }
    
    return baseValid;
  }, [selectedCompany, locationId, repairCentre, quantity, totalAvailableAtLocation, isSerialTracked, selectedSerialIds]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send for Repair</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
          {/* Company Selection Warning */}
          {!selectedCompany?.id && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Please select a specific company before sending items for repair. You are currently viewing "All Companies".
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

          {/* 2. Location */}
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Select value={locationId} onValueChange={setLocationId} disabled={!category}>
              <SelectTrigger>
                <SelectValue placeholder={category ? "Select location..." : "Select category first..."} />
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

          {/* 3. Repair Centre */}
          <div className="space-y-2">
            <Label htmlFor="repairCentre">Repair Centre</Label>
            <Input
              id="repairCentre"
              placeholder="Enter repair centre / service provider..."
              value={repairCentre}
              onChange={(e) => setRepairCentre(e.target.value)}
              disabled={!locationId}
            />
          </div>

          {/* 4. Quantity - Show available items in brackets */}
          {locationId && repairCentre.trim() && (
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
                placeholder="Enter quantity to send for repair..."
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

          {/* Issue Description */}
          <div className="space-y-2">
            <Label htmlFor="issueDescription">Issue Description (Optional)</Label>
            <Textarea
              id="issueDescription"
              placeholder="Describe the issue or reason for repair..."
              value={issueDescription}
              onChange={(e) => setIssueDescription(e.target.value)}
              rows={2}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any additional notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={sendForRepair.isPending}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={!isFormValid || sendForRepair.isPending}
            >
              {sendForRepair.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Send for Repair
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
