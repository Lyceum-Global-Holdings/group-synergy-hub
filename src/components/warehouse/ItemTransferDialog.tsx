import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
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
import { useWarehouseLocations } from "@/hooks/useWarehouseLocations";
import { WarehouseItem } from "@/types/itemBin";
import { useItemUnits } from "@/hooks/useItemUnits";

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
  const { locations = [] } = useWarehouseLocations();
  const { units } = useItemUnits();

  const mainLocations = locations.filter((l) => l.type === "location");
  const departments = locations.filter((l) => l.type === "department");

  const unitName = item?.unit_id 
    ? units.find(u => u.id === item.unit_id)?.abbreviation || "units"
    : "units";

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!item) return;

    // Validate quantity against available stock
    if (values.quantity > (item.current_stock || 0)) {
      form.setError("quantity", {
        message: `Cannot transfer more than available stock (${item.current_stock || 0})`,
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
      };

      const transfer = await createTransfer.mutateAsync(transferData);

      // Create the transfer item
      await createItem.mutateAsync({
        transfer_id: transfer.id,
        warehouse_item_id: item.id,
        item_name: item.name,
        quantity_requested: values.quantity,
        unit_of_measure: unitName,
      });

      form.reset();
      onOpenChange(false);
    } catch (error) {
      console.error("Error creating transfer:", error);
    }
  };

  const handleClose = () => {
    form.reset();
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
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Item Code:</span>
              <p className="font-medium">{item.item_code}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Item Name:</span>
              <p className="font-medium">{item.name}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Available Stock:</span>
              <p className="font-medium">{item.current_stock || 0} {unitName}</p>
            </div>
          </div>
        </div>

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
                      max={item.current_stock || 0}
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
              <Button type="submit" disabled={createTransfer.isPending || createItem.isPending}>
                {createTransfer.isPending ? "Creating Transfer..." : "Create Transfer"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
