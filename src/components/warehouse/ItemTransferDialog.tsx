import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateStockTransfer, useCreateStockTransferItem, useCompleteStockTransfer } from "@/hooks/useStockTransfer";
import { useWarehouseLocations } from "@/hooks/useWarehouseLocations";
import { WarehouseItem } from "@/types/itemBin";
import { useItemUnits } from "@/hooks/useItemUnits";
import { supabase } from "@/integrations/supabase/client";
import { StockTransferRequest } from "@/types/stockTransfer";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";

const formSchema = z.object({
  transfer_date: z.string(),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  from_location_id: z.string().min(1, "Source location is required"),
  from_department_id: z.string().optional(),
  to_location_id: z.string().min(1, "Destination location is required"),
  to_department_id: z.string().optional(),
  quantity: z.number().min(1, "Quantity must be at least 1"),
  reason: z.string().optional(),
  notes: z.string().optional(),
});

interface ItemTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: WarehouseItem | null;
}

export function ItemTransferDialog({
  open,
  onOpenChange,
  item,
}: ItemTransferDialogProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      transfer_date: new Date().toISOString().split("T")[0],
      priority: "normal",
      from_location_id: "",
      from_department_id: "",
      to_location_id: "",
      to_department_id: "",
      quantity: 1,
      reason: "",
      notes: "",
    },
  });

  const createTransfer = useCreateStockTransfer();
  const createItem = useCreateStockTransferItem();
  const completeTransfer = useCompleteStockTransfer();
  const { locations = [] } = useWarehouseLocations();
  const { units } = useItemUnits();

  // State for verification dialog
  const [showVerificationDialog, setShowVerificationDialog] = useState(false);
  const [pendingTransferData, setPendingTransferData] = useState<{
    transfer: StockTransferRequest;
    values: z.infer<typeof formSchema>;
  } | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);

  const mainLocations = locations.filter((l) => l.type === "location");
  const departments = locations.filter((l) => l.type === "department");

  const unitName = item?.unit_id 
    ? units.find(u => u.id === item.unit_id)?.abbreviation || "units"
    : "units";

  // Fetch bin allocations with location info for this item
  const { data: itemBinAllocations = [] } = useQuery({
    queryKey: ['item-bin-allocations-for-transfer', item?.id],
    queryFn: async () => {
      if (!item?.id) return [];
      
      const { data, error } = await supabase
        .from('warehouse_bin_allocations')
        .select(`
          id,
          allocated_quantity,
          available_quantity,
          warehouse_bins!inner (
            id,
            bin_code,
            name,
            location_id
          )
        `)
        .eq('warehouse_item_id', item.id)
        .gt('available_quantity', 0);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!item?.id && open,
  });

  // Aggregate stock by location
  const itemLocationsWithStock = useMemo(() => {
    const locationMap = new Map<string, { locationId: string; locationName: string; totalStock: number }>();
    
    itemBinAllocations.forEach((allocation: any) => {
      const locationId = allocation.warehouse_bins?.location_id;
      if (locationId) {
        const location = mainLocations.find(l => l.id === locationId);
        if (location) {
          const existing = locationMap.get(locationId);
          if (existing) {
            existing.totalStock += Number(allocation.available_quantity) || 0;
          } else {
            locationMap.set(locationId, {
              locationId,
              locationName: location.name,
              totalStock: Number(allocation.available_quantity) || 0,
            });
          }
        }
      }
    });

    // Also include the item's primary location if it has stock there
    if (item?.location_id && item.current_stock && item.current_stock > 0) {
      const primaryLocation = mainLocations.find(l => l.id === item.location_id);
      if (primaryLocation && !locationMap.has(item.location_id)) {
        locationMap.set(item.location_id, {
          locationId: item.location_id,
          locationName: primaryLocation.name,
          totalStock: item.current_stock,
        });
      }
    }

    return Array.from(locationMap.values());
  }, [itemBinAllocations, mainLocations, item]);

  const selectedFromLocation = form.watch('from_location_id');
  const selectedLocationStock = itemLocationsWithStock.find(l => l.locationId === selectedFromLocation)?.totalStock || 0;

  const hasLocationsWithStock = itemLocationsWithStock.length > 0;

  // Auto-set from_location_id when item changes
  useEffect(() => {
    if (item && open) {
      const defaultLocationId = itemLocationsWithStock.length > 0 
        ? itemLocationsWithStock[0].locationId 
        : item.location_id || "";
      
      form.reset({
        transfer_date: new Date().toISOString().split("T")[0],
        priority: "normal",
        from_location_id: defaultLocationId,
        from_department_id: "",
        to_location_id: "",
        to_department_id: "",
        quantity: 1,
        reason: "",
        notes: "",
      });
    }
  }, [item, open, form, itemLocationsWithStock.length]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!item) return;

    // Validate quantity against available stock at selected location
    const availableAtLocation = itemLocationsWithStock.find(l => l.locationId === values.from_location_id)?.totalStock || 0;
    if (values.quantity > availableAtLocation) {
      form.setError("quantity", {
        message: `Cannot transfer more than available stock at this location (${availableAtLocation})`,
      });
      return;
    }

    try {
      const transferData = {
        transfer_date: values.transfer_date,
        transfer_type: "location" as const,
        priority: values.priority,
        from_location_id: values.from_location_id,
        from_department_id: values.from_department_id || undefined,
        to_location_id: values.to_location_id,
        to_department_id: values.to_department_id || undefined,
        reason: values.reason || undefined,
        notes: values.notes || undefined,
        status: 'approved' as const, // Auto-approve transfers from Item Master
        company_id: item.company_id, // Include company_id from the item being transferred
      };

      const transfer = await createTransfer.mutateAsync(transferData);

      // Find the source bin allocation for the selected location
      const sourceBinAllocation = itemBinAllocations.find((alloc: any) => 
        alloc.warehouse_bins?.location_id === values.from_location_id
      );

      // Create the transfer item with source bin
      await createItem.mutateAsync({
        transfer_id: transfer.id,
        warehouse_item_id: item.id,
        item_name: item.name,
        quantity_requested: values.quantity,
        unit_of_measure: unitName,
        from_bin_id: sourceBinAllocation?.warehouse_bins?.id,
      });

      // Show verification dialog instead of closing
      setPendingTransferData({ transfer, values });
      setShowVerificationDialog(true);
    } catch (error) {
      console.error("Error creating transfer:", error);
    }
  };

  const handleConfirmTransfer = async () => {
    if (!pendingTransferData) return;
    
    setIsCompleting(true);
    try {
      // Complete the transfer immediately
      await completeTransfer.mutateAsync(pendingTransferData.transfer.id);
      
      // Reset and close
      setShowVerificationDialog(false);
      setPendingTransferData(null);
      form.reset();
      onOpenChange(false);
    } catch (error) {
      console.error("Error completing transfer:", error);
    } finally {
      setIsCompleting(false);
    }
  };

  const handleCancelVerification = () => {
    // Keep the transfer as approved but don't complete it
    setShowVerificationDialog(false);
    setPendingTransferData(null);
    form.reset();
    onOpenChange(false);
  };

  // Get location names for verification dialog
  const fromLocationName = useMemo(() => {
    if (!pendingTransferData) return "";
    return itemLocationsWithStock.find(l => l.locationId === pendingTransferData.values.from_location_id)?.locationName || "";
  }, [pendingTransferData, itemLocationsWithStock]);

  const toLocationName = useMemo(() => {
    if (!pendingTransferData) return "";
    return mainLocations.find(l => l.id === pendingTransferData.values.to_location_id)?.name || "";
  }, [pendingTransferData, mainLocations]);

  const handleClose = () => {
    if (showVerificationDialog) return; // Don't close if verification is showing
    form.reset();
    setPendingTransferData(null);
    onOpenChange(false);
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Transfer Item Between Warehouses</DialogTitle>
          <DialogDescription>
            Transfer "{item.name}" ({item.item_code}) to a different location
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted p-3 rounded-lg mb-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Item Code:</span>
              <p className="font-medium">{item.item_code}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Item Name:</span>
              <p className="font-medium">{item.name}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Total Stock:</span>
              <p className="font-medium">{item.current_stock || 0} {unitName}</p>
            </div>
          </div>
          {itemLocationsWithStock.length > 0 && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-xs text-muted-foreground mb-2">Stock by Location:</p>
              <div className="flex flex-wrap gap-2">
                {itemLocationsWithStock.map((loc) => (
                  <span key={loc.locationId} className="inline-flex items-center gap-1 px-2 py-1 bg-background rounded text-xs">
                    <span className="font-medium">{loc.locationName}:</span>
                    <span>{loc.totalStock} {unitName}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {!hasLocationsWithStock && (
          <div className="bg-destructive/10 text-destructive p-3 rounded-lg mb-4 text-sm">
            This item has no stock in any location. Cannot transfer items without available stock.
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="transfer_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transfer Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-sm">Source Location</h3>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="from_location_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>From Location *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select source location" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {itemLocationsWithStock.map((loc) => (
                            <SelectItem key={loc.locationId} value={loc.locationId}>
                              {loc.locationName} ({loc.totalStock} {unitName} available)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedFromLocation && (
                        <p className="text-xs text-muted-foreground">
                          Available: {selectedLocationStock} {unitName}
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="from_department_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>From Department</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {departments.map((dept) => (
                            <SelectItem key={dept.id} value={dept.id}>
                              {dept.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-sm">Destination Location</h3>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="to_location_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>To Location *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select location" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {mainLocations.map((loc) => (
                            <SelectItem key={loc.id} value={loc.id}>
                              {loc.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="to_department_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>To Department</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {departments.map((dept) => (
                            <SelectItem key={dept.id} value={dept.id}>
                              {dept.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity to Transfer *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={selectedLocationStock || 0}
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason</FormLabel>
                  <FormControl>
                    <Input placeholder="Reason for transfer" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Additional notes" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createTransfer.isPending || createItem.isPending || !hasLocationsWithStock}
              >
                {createTransfer.isPending ? "Creating Transfer..." : "Create Transfer"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>

      {/* Verification Dialog */}
      <AlertDialog open={showVerificationDialog} onOpenChange={setShowVerificationDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Verify & Complete Transfer
            </AlertDialogTitle>
            <AlertDialogDescription>
              Please verify the transfer details before completing. Once completed, the stock will be moved immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          {pendingTransferData && item && (
            <div className="space-y-4 py-4">
              <div className="bg-muted rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Item</p>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.item_code}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Quantity</p>
                    <p className="font-medium text-lg">{pendingTransferData.values.quantity} {unitName}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 justify-center">
                <div className="text-center flex-1 bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">From</p>
                  <p className="font-medium">{fromLocationName}</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <div className="text-center flex-1 bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">To</p>
                  <p className="font-medium">{toLocationName}</p>
                </div>
              </div>

              {pendingTransferData.values.reason && (
                <div className="text-sm">
                  <p className="text-muted-foreground text-xs mb-1">Reason</p>
                  <p>{pendingTransferData.values.reason}</p>
                </div>
              )}
            </div>
          )}
          
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelVerification} disabled={isCompleting}>
              Cancel (Keep as Pending)
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmTransfer} disabled={isCompleting}>
              {isCompleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Completing...
                </>
              ) : (
                "Verify & Complete Transfer"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
