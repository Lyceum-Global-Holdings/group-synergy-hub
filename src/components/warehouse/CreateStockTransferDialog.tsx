import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useWarehouseItems } from "@/hooks/useWarehouseItems";
import { useWarehouseLocations } from "@/hooks/useWarehouseLocations";
import { ItemSelector } from "@/components/common/ItemSelector";
import { useCurrentUserLocationPermissions } from "@/hooks/useCurrentUserLocationPermissions";
import { useCompany } from "@/contexts/CompanyContext";
import { useIsAdminOrHigher } from "@/hooks/useIsAdminOrHigher";

const formSchema = z.object({
  transfer_date: z.string(),
  transfer_type: z.enum(["location", "department", "emergency"]),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  from_bin_id: z.string().min(1, "Source bin is required"),
  to_bin_id: z.string().min(1, "Destination bin is required"),
  expected_completion_date: z.string().optional(),
  reason: z.string().optional(),
  notes: z.string().optional(),
}).refine((data) => data.from_bin_id !== data.to_bin_id, {
  message: "Source and destination bins must be different",
  path: ["to_bin_id"],
});

interface TransferItemForm {
  warehouse_item_id: string;
  item_name: string;
  quantity_requested: number;
  unit_of_measure: string;
  from_bin_id: string;
  to_bin_id: string;
  notes?: string;
}

interface CreateStockTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateStockTransferDialog({
  open,
  onOpenChange,
}: CreateStockTransferDialogProps) {
  const [transferItems, setTransferItems] = useState<TransferItemForm[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [itemQuantity, setItemQuantity] = useState("");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      transfer_date: new Date().toISOString().split("T")[0],
      transfer_type: "location",
      priority: "normal",
      from_bin_id: "",
      to_bin_id: "",
    },
  });

  const createTransfer = useCreateStockTransfer();
  const createItem = useCreateStockTransferItem();
  const { bins = [] } = useWarehouseBins();
  const { items: warehouseItems = [] } = useWarehouseItems();
  const { locations = [] } = useWarehouseLocations();
  const { data: permissions } = useCurrentUserLocationPermissions();
  const { selectedCompany } = useCompany();

  // Filter bins to only show those at locations user can edit
  const editableBins = useMemo(() => {
    if (!permissions || permissions.viewAllLocations) return bins;
    const editLocationIds = new Set(permissions.editLocationIds);
    return bins.filter(b => editLocationIds.has(b.location_id));
  }, [bins, permissions]);

  // Group bins by location for easier selection
  const getBinDisplayName = (bin: typeof bins[0]) => {
    const location = locations.find(l => l.id === bin.location_id);
    const locationName = location?.name || "Unassigned";
    return `${bin.bin_code} - ${bin.name} (${locationName})`;
  };

  const handleAddItem = () => {
    if (!selectedItem || !itemQuantity) return;

    const fromBinId = form.getValues("from_bin_id");
    const toBinId = form.getValues("to_bin_id");

    if (!fromBinId || !toBinId) {
      form.setError("root", {
        message: "Please select source and destination bins first",
      });
      return;
    }

    setTransferItems([
      ...transferItems,
      {
        warehouse_item_id: selectedItem.id,
        item_name: selectedItem.name,
        quantity_requested: parseFloat(itemQuantity),
        unit_of_measure: selectedItem.unit_of_measure,
        from_bin_id: fromBinId,
        to_bin_id: toBinId,
      },
    ]);

    setSelectedItem(null);
    setItemQuantity("");
  };

  const handleRemoveItem = (index: number) => {
    setTransferItems(transferItems.filter((_, i) => i !== index));
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (transferItems.length === 0) {
      form.setError("root", {
        message: "Please add at least one item to the transfer",
      });
      return;
    }

    try {
      const fromBin = editableBins.find((b) => b.id === values.from_bin_id);
      const toBin = editableBins.find((b) => b.id === values.to_bin_id);
      const resolvedCompanyId =
        (fromBin as any)?.company_id ||
        (toBin as any)?.company_id ||
        selectedCompany?.id;

      if (!resolvedCompanyId) {
        form.setError("root", {
          message: "Cannot determine company for this transfer. Select an active company in the header and try again.",
        });
        return;
      }

      const transferData = {
        transfer_date: values.transfer_date || new Date().toISOString().split("T")[0],
        transfer_type: values.transfer_type,
        priority: values.priority,
        from_bin_id: values.from_bin_id,
        to_bin_id: values.to_bin_id,
        expected_completion_date: values.expected_completion_date,
        reason: values.reason,
        notes: values.notes,
        company_id: resolvedCompanyId,
        from_location_id: fromBin?.location_id ?? null,
        to_location_id: toBin?.location_id ?? null,
      };

      const transfer = await createTransfer.mutateAsync(transferData);

      // Create all items
      for (const item of transferItems) {
        await createItem.mutateAsync({
          transfer_id: transfer.id,
          warehouse_item_id: item.warehouse_item_id,
          item_name: item.item_name,
          quantity_requested: item.quantity_requested,
          unit_of_measure: item.unit_of_measure,
          from_bin_id: item.from_bin_id,
          to_bin_id: item.to_bin_id,
          notes: item.notes,
        });
      }

      form.reset();
      setTransferItems([]);
      onOpenChange(false);
    } catch (error) {
      console.error("Error creating transfer:", error);
    }
  };

  const selectedFromBin = editableBins.find(b => b.id === form.watch("from_bin_id"));
  const selectedToBin = editableBins.find(b => b.id === form.watch("to_bin_id"));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Stock Transfer</DialogTitle>
          <DialogDescription>
            Creates a transfer request (pending approval). Stock physically moves only after the request is approved and completed. For an immediate bin-to-bin move, use the “Move stock” action on Bin Allocations.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                name="expected_completion_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expected Completion</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="transfer_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transfer Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="location">Location</SelectItem>
                        <SelectItem value="department">Department</SelectItem>
                        <SelectItem value="emergency">Emergency</SelectItem>
                      </SelectContent>
                    </Select>
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
                <h3 className="font-semibold">Source Bin</h3>
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
                          {editableBins.map((bin) => (
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
                {selectedFromBin && (
                  <p className="text-xs text-muted-foreground">
                    Current Qty: {selectedFromBin.current_quantity || 0}
                  </p>
                )}
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold">Destination Bin</h3>
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
                          {editableBins.map((bin) => (
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
                {selectedToBin && (
                  <p className="text-xs text-muted-foreground">
                    Current Qty: {selectedToBin.current_quantity || 0}
                  </p>
                )}
              </div>
            </div>

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

            <div className="space-y-4">
              <h3 className="font-semibold">Transfer Items</h3>
              
              <div className="flex gap-2">
                <div className="flex-1">
                  <ItemSelector
                    value={selectedItem?.id}
                    onSelect={setSelectedItem}
                  />
                </div>
                <Input
                  type="number"
                  placeholder="Quantity"
                  value={itemQuantity}
                  onChange={(e) => setItemQuantity(e.target.value)}
                  className="w-32"
                />
                <Button type="button" onClick={handleAddItem}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {transferItems.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-2">Item</th>
                        <th className="text-right p-2">Quantity</th>
                        <th className="text-center p-2">Unit</th>
                        <th className="text-center p-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transferItems.map((item, index) => (
                        <tr key={index} className="border-t">
                          <td className="p-2">{item.item_name}</td>
                          <td className="text-right p-2">{item.quantity_requested}</td>
                          <td className="text-center p-2">{item.unit_of_measure}</td>
                          <td className="text-center p-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveItem(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {form.formState.errors.root && (
              <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createTransfer.isPending}>
                Create Transfer
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
