import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowRight, MapPin } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { WarehouseAsset, WarehouseLocation } from "@/types/warehouse";
import { useWarehouseAssets } from "@/hooks/useWarehouseAssets";
import { useEffect } from "react";

const transferAssetSchema = z.object({
  location_id: z.string().optional(),
  sublocation_id: z.string().optional(),
  department_id: z.string().optional(),
  transfer_reason: z.string().min(1, "Transfer reason is required"),
  transfer_date: z.string().min(1, "Transfer date is required"),
  notes: z.string().optional(),
}).refine((data) => {
  return data.location_id || data.sublocation_id || data.department_id;
}, {
  message: "At least one location must be selected",
  path: ["location_id"],
});

type TransferAssetFormValues = z.infer<typeof transferAssetSchema>;

interface AssetTransferDialogProps {
  asset: WarehouseAsset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locations: WarehouseLocation[];
  getLocationsByType: (type: string, parentId?: string) => WarehouseLocation[];
  getLocationName: (locationId: string | null) => string;
}

export function AssetTransferDialog({
  asset,
  open,
  onOpenChange,
  locations,
  getLocationsByType,
  getLocationName,
}: AssetTransferDialogProps) {
  const { updateAsset, isUpdating } = useWarehouseAssets();

  const form = useForm<TransferAssetFormValues>({
    resolver: zodResolver(transferAssetSchema),
    defaultValues: {
      location_id: "",
      sublocation_id: "",
      department_id: "",
      transfer_reason: "",
      transfer_date: new Date().toISOString().split('T')[0],
      notes: "",
    },
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      form.reset({
        location_id: "",
        sublocation_id: "",
        department_id: "",
        transfer_reason: "",
        transfer_date: new Date().toISOString().split('T')[0],
        notes: "",
      });
    }
  }, [open, form]);

  const onSubmit = (data: TransferAssetFormValues) => {
    if (!asset) return;

    const updateData = {
      location_id: data.location_id || null,
      sublocation_id: data.sublocation_id || null,
      department_id: data.department_id || null,
      // Add transfer note to existing notes
      notes: asset.notes 
        ? `${asset.notes}\n\n--- Transfer ${data.transfer_date} ---\nReason: ${data.transfer_reason}\n${data.notes ? `Notes: ${data.notes}` : ''}`
        : `--- Transfer ${data.transfer_date} ---\nReason: ${data.transfer_reason}\n${data.notes ? `Notes: ${data.notes}` : ''}`,
    };

    updateAsset({ id: asset.id, ...updateData });
    onOpenChange(false);
  };

  const selectedLocationId = form.watch("location_id");
  const selectedSublocationId = form.watch("sublocation_id");

  const mainLocations = getLocationsByType('location');
  const sublocations = getLocationsByType('sublocation', selectedLocationId);
  const departments = getLocationsByType('department', selectedSublocationId || selectedLocationId);

  if (!asset) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Transfer Asset: {asset.name}</DialogTitle>
        </DialogHeader>

        {/* Current Location Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center">
              <MapPin className="h-4 w-4 mr-2" />
              Current Location
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-sm space-y-1">
              <div>
                <span className="font-medium">Location:</span> {getLocationName(asset.location_id) || 'Not assigned'}
              </div>
              <div>
                <span className="font-medium">Sublocation:</span> {getLocationName(asset.sublocation_id) || 'Not assigned'}
              </div>
              <div>
                <span className="font-medium">Department:</span> {getLocationName(asset.department_id) || 'Not assigned'}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-center">
          <ArrowRight className="h-6 w-6 text-muted-foreground" />
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">New Location</CardTitle>
                <CardDescription>Select the new location for this asset</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <FormField
                    control={form.control}
                    name="location_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select location" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {mainLocations.map((location) => (
                              <SelectItem key={location.id} value={location.id}>
                                {location.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {selectedLocationId && (
                    <FormField
                      control={form.control}
                      name="sublocation_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sublocation</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select sublocation" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {sublocations.map((sublocation) => (
                                <SelectItem key={sublocation.id} value={sublocation.id}>
                                  {sublocation.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {(selectedLocationId || selectedSublocationId) && (
                    <FormField
                      control={form.control}
                      name="department_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Department</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select department" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {departments.map((department) => (
                                <SelectItem key={department.id} value={department.id}>
                                  {department.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Transfer Details</CardTitle>
                <CardDescription>Provide details about this transfer</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="transfer_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Transfer Date *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="transfer_reason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Transfer Reason *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Department reorganization, Equipment upgrade, etc." {...field} />
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
                      <FormLabel>Additional Notes</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Add any additional notes about this transfer..." 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isUpdating}>
                {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Transfer Asset
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}