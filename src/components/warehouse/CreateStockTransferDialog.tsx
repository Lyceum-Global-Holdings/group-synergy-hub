import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, Trash2, ClipboardPaste, ArrowRight, ArrowLeftRight, PackageOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PasteTransferItemsDialog, type PastedTransferItem } from "./stock-transfer/PasteTransferItemsDialog";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
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
  const [pasteOpen, setPasteOpen] = useState(false);

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
  const { canDelete: isAdminOrHigher } = useIsAdminOrHigher();

  // Filter bins to only show those at locations user can edit
  const editableBins = useMemo(() => {
    if (!permissions || permissions.viewAllLocations) return bins;
    const editLocationIds = new Set(permissions.editLocationIds);
    return bins.filter(b => editLocationIds.has(b.location_id));
  }, [bins, permissions]);

  // Group bins by location so long bin lists stay scannable in the dropdowns.
  const binsByLocation = useMemo(() => {
    const groups = new Map<string, typeof bins>();
    for (const bin of editableBins) {
      const name = locations.find((l) => l.id === bin.location_id)?.name || "Unassigned";
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name)!.push(bin);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [editableBins, locations]);

  const handleAddItem = () => {
    const qty = parseFloat(itemQuantity);
    if (!selectedItem || !qty || qty <= 0) return;

    const fromBinId = form.getValues("from_bin_id");
    const toBinId = form.getValues("to_bin_id");
    if (!fromBinId || !toBinId) return; // entry row is disabled until bins are chosen

    form.clearErrors("root");
    // Same item added twice → merge quantities (matches the paste behaviour).
    setTransferItems((prev) => {
      const idx = prev.findIndex(
        (p) => p.warehouse_item_id === selectedItem.id && p.from_bin_id === fromBinId && p.to_bin_id === toBinId,
      );
      if (idx >= 0) {
        return prev.map((p, i) =>
          i === idx ? { ...p, quantity_requested: p.quantity_requested + qty } : p,
        );
      }
      return [
        ...prev,
        {
          warehouse_item_id: selectedItem.id,
          item_name: selectedItem.name,
          quantity_requested: qty,
          unit_of_measure: selectedItem.unit_of_measure,
          from_bin_id: fromBinId,
          to_bin_id: toBinId,
        },
      ];
    });

    setSelectedItem(null);
    setItemQuantity("");
  };

  const handleRemoveItem = (index: number) => {
    setTransferItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemQtyChange = (index: number, qty: number) => {
    setTransferItems((prev) =>
      prev.map((p, i) => (i === index ? { ...p, quantity_requested: qty } : p)),
    );
  };

  const swapBins = () => {
    const from = form.getValues("from_bin_id");
    const to = form.getValues("to_bin_id");
    form.setValue("from_bin_id", to, { shouldValidate: true });
    form.setValue("to_bin_id", from, { shouldValidate: true });
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
        ...(isAdminOrHigher ? { status: 'approved' as const } : {}),
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
  const binsChosen = !!selectedFromBin && !!selectedToBin;
  const totalUnits = transferItems.reduce((s, it) => s + (it.quantity_requested || 0), 0);

  const renderBinOptions = () =>
    binsByLocation.map(([locationName, group]) => (
      <SelectGroup key={locationName}>
        <SelectLabel>{locationName}</SelectLabel>
        {group.map((bin) => (
          <SelectItem key={bin.id} value={bin.id}>
            {bin.bin_code} — {bin.name}
          </SelectItem>
        ))}
      </SelectGroup>
    ));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Stock Transfer</DialogTitle>
          <DialogDescription>
            {isAdminOrHigher
              ? "Transfer is auto-approved. Mark items as completed to physically move stock. For an immediate bin-to-bin move, use the “Move stock” action on Bin Allocations."
              : "Creates a transfer request (pending approval). Stock physically moves only after the request is approved and completed. For an immediate bin-to-bin move, use the “Move stock” action on Bin Allocations."}
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

            {/* Route: source → destination, with a one-click swap. */}
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3">
                <FormField
                  control={form.control}
                  name="from_bin_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>From bin *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select source bin" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>{renderBinOptions()}</SelectContent>
                      </Select>
                      <div className="min-h-5">
                        {selectedFromBin && (
                          <Badge variant="secondary" className="text-xs font-normal">
                            {selectedFromBin.current_quantity || 0} in bin
                          </Badge>
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex flex-col items-center gap-1 pt-8">
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={swapBins}
                    disabled={!form.watch("from_bin_id") && !form.watch("to_bin_id")}
                    title="Swap source and destination"
                  >
                    <ArrowLeftRight className="h-4 w-4" />
                  </Button>
                </div>

                <FormField
                  control={form.control}
                  name="to_bin_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>To bin *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select destination bin" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>{renderBinOptions()}</SelectContent>
                      </Select>
                      <div className="min-h-5">
                        {selectedToBin && (
                          <Badge variant="secondary" className="text-xs font-normal">
                            {selectedToBin.current_quantity || 0} in bin
                          </Badge>
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                    <Textarea placeholder="Additional notes" rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold">Transfer Items</h3>
                  <p className="text-xs text-muted-foreground">
                    Tip: paste from Excel — code, qty, uom.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!binsChosen}
                  title={binsChosen ? "Paste code, qty, uom rows copied from Excel" : "Select both bins first"}
                  onClick={() => {
                    form.clearErrors("root");
                    setPasteOpen(true);
                  }}
                >
                  <ClipboardPaste className="h-4 w-4 mr-1" />
                  Paste items
                </Button>
              </div>

              {!binsChosen ? (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground text-center">
                  Select the source and destination bins above to start adding items.
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <ItemSelector
                        value={selectedItem?.id}
                        onSelect={setSelectedItem}
                      />
                    </div>
                    <Input
                      type="number"
                      min={1}
                      placeholder="Qty"
                      value={itemQuantity}
                      onChange={(e) => setItemQuantity(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddItem();
                        }
                      }}
                      className="w-28"
                    />
                    <Button
                      type="button"
                      onClick={handleAddItem}
                      disabled={!selectedItem || !(parseFloat(itemQuantity) > 0)}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add
                    </Button>
                  </div>

                  {transferItems.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-6 flex flex-col items-center gap-1.5 text-center">
                      <PackageOpen className="h-6 w-6 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        No items yet. Search above and press Enter, or paste a list from Excel.
                      </p>
                    </div>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted">
                          <tr>
                            <th className="text-left p-2 w-8">#</th>
                            <th className="text-left p-2">Item</th>
                            <th className="text-right p-2 w-28">Quantity</th>
                            <th className="text-center p-2 w-20">Unit</th>
                            <th className="w-12"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {transferItems.map((item, index) => (
                            <tr key={`${item.warehouse_item_id}-${index}`} className="border-t">
                              <td className="p-2 text-muted-foreground">{index + 1}</td>
                              <td className="p-2">{item.item_name}</td>
                              <td className="p-2 text-right">
                                <Input
                                  type="number"
                                  min={1}
                                  value={item.quantity_requested}
                                  onChange={(e) =>
                                    handleItemQtyChange(index, Math.max(1, Number(e.target.value) || 1))
                                  }
                                  className="w-24 h-8 ml-auto text-right"
                                />
                              </td>
                              <td className="p-2 text-center text-muted-foreground">{item.unit_of_measure}</td>
                              <td className="p-2 text-center">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive"
                                  onClick={() => handleRemoveItem(index)}
                                  title="Remove item"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-muted/50 border-t">
                          <tr>
                            <td className="p-2 font-medium" colSpan={2}>
                              {transferItems.length} item{transferItems.length === 1 ? "" : "s"}
                            </td>
                            <td className="p-2 text-right font-medium">{totalUnits}</td>
                            <td colSpan={2}></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>

            {form.formState.errors.root && (
              <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
            )}

            <div className="flex items-center justify-between gap-2 border-t pt-4">
              <p className="text-sm text-muted-foreground">
                {transferItems.length > 0
                  ? `${transferItems.length} item${transferItems.length === 1 ? "" : "s"} · ${totalUnits} unit${totalUnits === 1 ? "" : "s"}`
                  : "Add at least one item to continue"}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createTransfer.isPending || createItem.isPending || transferItems.length === 0}
                >
                  {createTransfer.isPending || createItem.isPending
                    ? "Creating…"
                    : isAdminOrHigher
                      ? "Create & Approve Transfer"
                      : "Submit for Approval"}
                </Button>
              </div>
            </div>
          </form>
        </Form>

        <PasteTransferItemsDialog
          open={pasteOpen}
          onOpenChange={setPasteOpen}
          catalog={warehouseItems as any}
          fromBinId={form.watch("from_bin_id")}
          onConfirm={(items: PastedTransferItem[]) => {
            const fromBinId = form.getValues("from_bin_id");
            const toBinId = form.getValues("to_bin_id");
            setTransferItems((prev) => {
              const merged = [...prev];
              for (const it of items) {
                const existingIdx = merged.findIndex(
                  (p) =>
                    p.warehouse_item_id === it.warehouse_item_id &&
                    p.from_bin_id === fromBinId &&
                    p.to_bin_id === toBinId,
                );
                if (existingIdx >= 0) {
                  merged[existingIdx] = {
                    ...merged[existingIdx],
                    quantity_requested:
                      merged[existingIdx].quantity_requested +
                      it.quantity_requested,
                  };
                } else {
                  merged.push({
                    warehouse_item_id: it.warehouse_item_id,
                    item_name: it.item_name,
                    quantity_requested: it.quantity_requested,
                    unit_of_measure: it.unit_of_measure,
                    from_bin_id: fromBinId,
                    to_bin_id: toBinId,
                  });
                }
              }
              return merged;
            });
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
