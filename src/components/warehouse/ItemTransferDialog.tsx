import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery } from "@tanstack/react-query";
import { useCurrentUserLocationPermissions } from "@/hooks/useCurrentUserLocationPermissions";
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
import { useCreateStockTransfer, useCreateStockTransferItem } from "@/hooks/useStockTransfer";
import { useWarehouseBins } from "@/hooks/useWarehouseBins";
import { useWarehouseLocations } from "@/hooks/useWarehouseLocations";
import { WarehouseItem } from "@/types/itemBin";
import { useItemUnits } from "@/hooks/useItemUnits";
import { supabase } from "@/integrations/supabase/client";
import { StockTransferRequest } from "@/types/stockTransfer";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";

const formSchema = z.object({
  transfer_date: z.string(),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  from_bin_id: z.string().min(1, "Source bin is required"),
  to_bin_id: z.string().min(1, "Destination bin is required"),
  quantity: z.number().min(1, "Quantity must be at least 1"),
  reason: z.string().optional(),
  notes: z.string().optional(),
}).refine((data) => data.from_bin_id !== data.to_bin_id, {
  message: "Source and destination bins must be different",
  path: ["to_bin_id"],
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
      from_bin_id: "",
      to_bin_id: "",
      quantity: 1,
      reason: "",
      notes: "",
    },
  });

  const createTransfer = useCreateStockTransfer();
  const createItem = useCreateStockTransferItem();
  const { bins = [] } = useWarehouseBins();
  const { locations = [] } = useWarehouseLocations();
  const { units } = useItemUnits();
  const { data: permissions } = useCurrentUserLocationPermissions();

  // State for verification dialog
  const [showVerificationDialog, setShowVerificationDialog] = useState(false);
  const [pendingTransferData, setPendingTransferData] = useState<{
    transfer: StockTransferRequest;
    values: z.infer<typeof formSchema>;
  } | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);

  const unitName = item?.unit_id 
    ? units.find(u => u.id === item.unit_id)?.abbreviation || "units"
    : "units";

  // Fetch bin allocations for this item (already consolidated by unique constraint)
  const { data: itemBinAllocations = [] } = useQuery({
    queryKey: ['item-bin-allocations-for-transfer', item?.id],
    queryFn: async () => {
      if (!item?.id) return [];
      
      const { data, error } = await supabase
        .from('warehouse_bin_allocations')
        .select(`
          id,
          bin_id,
          allocated_quantity,
          available_quantity,
          warehouse_bins:bin_id (
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

  // Get bins with stock for this item, filtered by edit permissions
  const binsWithStock = useMemo(() => {
    const editLocationIds = permissions && !permissions.viewAllLocations
      ? new Set([...permissions.editLocationIds])
      : null;

    return itemBinAllocations.map((allocation: any) => {
      const bin = allocation.warehouse_bins;
      const location = locations.find(l => l.id === bin?.location_id);
      return {
        binId: bin?.id,
        binCode: bin?.bin_code,
        binName: bin?.name,
        locationId: bin?.location_id,
        locationName: location?.name || "Unassigned",
        availableQty: Number(allocation.available_quantity) || 0,
      };
    }).filter(b => {
      if (!b.binId) return false;
      if (editLocationIds && !editLocationIds.has(b.locationId)) return false;
      return true;
    });
  }, [itemBinAllocations, locations, permissions]);

  const getBinDisplayName = (bin: typeof bins[0]) => {
    const location = locations.find(l => l.id === bin.location_id);
    const locationName = location?.name || "Unassigned";
    return `${bin.bin_code} - ${bin.name} (${locationName})`;
  };

  const selectedFromBinId = form.watch('from_bin_id');
  const selectedBinStock = binsWithStock.find(b => b.binId === selectedFromBinId)?.availableQty || 0;

  const hasBinsWithStock = binsWithStock.length > 0;

  // Auto-set from_bin_id when item changes
  useEffect(() => {
    if (item && open) {
      const defaultBinId = binsWithStock.length > 0 
        ? binsWithStock[0].binId 
        : "";
      
      form.reset({
        transfer_date: new Date().toISOString().split("T")[0],
        priority: "normal",
        from_bin_id: defaultBinId,
        to_bin_id: "",
        quantity: 1,
        reason: "",
        notes: "",
      });
    }
  }, [item, open, binsWithStock.length]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!item) return;

    // Validate quantity against available stock at selected bin
    const availableAtBin = binsWithStock.find(b => b.binId === values.from_bin_id)?.availableQty || 0;
    if (values.quantity > availableAtBin) {
      form.setError("quantity", {
        message: `Cannot transfer more than available stock at this bin (${availableAtBin})`,
      });
      return;
    }

    try {
      const transferData = {
        transfer_date: values.transfer_date,
        transfer_type: "location" as const,
        priority: values.priority,
        from_bin_id: values.from_bin_id,
        to_bin_id: values.to_bin_id,
        reason: values.reason || undefined,
        notes: values.notes || undefined,
        status: 'approved' as const, // Auto-approve transfers from Item Master
        company_id: item.company_id,
      };

      const transfer = await createTransfer.mutateAsync(transferData);

      // Create the transfer item with bin IDs
      await createItem.mutateAsync({
        transfer_id: transfer.id,
        warehouse_item_id: item.id,
        item_name: item.name,
        quantity_requested: values.quantity,
        unit_of_measure: unitName,
        from_bin_id: values.from_bin_id,
        to_bin_id: values.to_bin_id,
      });

      // Show verification dialog instead of closing
      setPendingTransferData({ transfer, values });
      setShowVerificationDialog(true);
    } catch (error) {
      console.error("Error creating transfer:", error);
    }
  };

  const handleConfirmTransfer = async () => {
    if (!pendingTransferData || !item) return;
    
    setIsCompleting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Call the FIFO transfer RPC
      const { data: result, error: rpcError } = await supabase.rpc('transfer_stock_fifo', {
        p_item_id: item.id,
        p_from_bin_id: pendingTransferData.values.from_bin_id,
        p_to_bin_id: pendingTransferData.values.to_bin_id,
        p_quantity: pendingTransferData.values.quantity,
        p_company_id: item.company_id,
        p_user_id: user.id,
        p_transfer_number: pendingTransferData.transfer.transfer_number,
        p_transfer_id: pendingTransferData.transfer.id,
      });

      if (rpcError) throw rpcError;

      // Mark transfer as completed
      await supabase
        .from('stock_transfer_requests')
        .update({
          status: 'completed',
          completed_by: user.id,
          completed_date: new Date().toISOString(),
        })
        .eq('id', pendingTransferData.transfer.id);

      // Mark transfer items as completed
      await supabase
        .from('stock_transfer_items')
        .update({
          status: 'completed',
          quantity_transferred: pendingTransferData.values.quantity,
        })
        .eq('transfer_id', pendingTransferData.transfer.id);

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

  // Get bin names for verification dialog
  const fromBinInfo = useMemo(() => {
    if (!pendingTransferData) return null;
    return binsWithStock.find(b => b.binId === pendingTransferData.values.from_bin_id);
  }, [pendingTransferData, binsWithStock]);

  const toBinInfo = useMemo(() => {
    if (!pendingTransferData) return null;
    const bin = bins.find(b => b.id === pendingTransferData.values.to_bin_id);
    if (!bin) return null;
    const location = locations.find(l => l.id === bin.location_id);
    return {
      binCode: bin.bin_code,
      binName: bin.name,
      locationName: location?.name || "Unassigned",
    };
  }, [pendingTransferData, bins, locations]);

  const handleClose = () => {
    if (showVerificationDialog) return; // Don't close if verification is showing
    form.reset();
    setPendingTransferData(null);
    onOpenChange(false);
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Transfer Item Between Bins</DialogTitle>
          <DialogDescription>
            Transfer "{item.name}" ({item.item_code}) to a different bin
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
          {binsWithStock.length > 0 && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-xs text-muted-foreground mb-2">Stock by Bin:</p>
              <div className="flex flex-wrap gap-2">
                {binsWithStock.map((bin) => (
                  <span key={bin.binId} className="inline-flex items-center gap-1 px-2 py-1 bg-background rounded text-xs">
                    <span className="font-medium">{bin.binCode} ({bin.locationName}):</span>
                    <span>{bin.availableQty} {unitName}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {!hasBinsWithStock && (
          <div className="bg-destructive/10 text-destructive p-3 rounded-lg mb-4 text-sm">
            This item has no stock in any bin. Cannot transfer items without available stock.
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

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="font-semibold text-sm">Source Bin</h3>
                <FormField
                  control={form.control}
                  name="from_bin_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>From Bin *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select source bin" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {binsWithStock.map((bin) => (
                            <SelectItem key={bin.binId} value={bin.binId}>
                              {bin.binCode} - {bin.binName} ({bin.locationName}) - {bin.availableQty} {unitName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedFromBinId && (
                        <p className="text-xs text-muted-foreground">
                          Available: {selectedBinStock} {unitName}
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-sm">Destination Bin</h3>
                <FormField
                  control={form.control}
                  name="to_bin_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>To Bin *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select destination bin" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {bins.map((bin) => (
                            <SelectItem key={bin.id} value={bin.id}>
                              {getBinDisplayName(bin)}
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
                      max={selectedBinStock || 0}
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
                disabled={createTransfer.isPending || createItem.isPending || !hasBinsWithStock}
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
                  <p className="text-xs text-muted-foreground mb-1">From Bin</p>
                  <p className="font-medium">{fromBinInfo?.binCode} - {fromBinInfo?.binName}</p>
                  <p className="text-xs text-muted-foreground">{fromBinInfo?.locationName}</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <div className="text-center flex-1 bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">To Bin</p>
                  <p className="font-medium">{toBinInfo?.binCode} - {toBinInfo?.binName}</p>
                  <p className="text-xs text-muted-foreground">{toBinInfo?.locationName}</p>
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
