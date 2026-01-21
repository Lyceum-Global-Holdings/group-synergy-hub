import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ArrowRight, MapPin, AlertTriangle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAssetTransferMutation } from "@/hooks/useAssetTransferMutation";
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { WarehouseLocation } from "@/types/warehouse";

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

interface PublicAssetTransferDialogProps {
  assetId: string;
  assetName: string;
  currentLocation: string | null;
  currentSublocation: string | null;
  currentDepartment: string | null;
  currentLocationId: string | null;
  currentSublocationId: string | null;
  currentDepartmentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function PublicAssetTransferDialog({
  assetId,
  assetName,
  currentLocation,
  currentSublocation,
  currentDepartment,
  currentLocationId,
  currentSublocationId,
  currentDepartmentId,
  open,
  onOpenChange,
  onSuccess,
}: PublicAssetTransferDialogProps) {
  const { mutate: transferAsset, isPending: isTransferring } = useAssetTransferMutation();

  // Fetch locations when dialog is open (requires auth)
  const { data: locations = [], isLoading: locationsLoading } = useQuery({
    queryKey: ['warehouse-locations-for-transfer'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('warehouse_locations')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as WarehouseLocation[];
    },
    enabled: open,
  });

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
    transferAsset({
      assetId,
      fromLocationId: currentLocationId,
      toLocationId: data.location_id || null,
      fromSublocationId: currentSublocationId,
      toSublocationId: data.sublocation_id || null,
      fromDepartmentId: currentDepartmentId,
      toDepartmentId: data.department_id || null,
      transferReason: data.transfer_reason,
      notes: data.notes,
    }, {
      onSuccess: () => {
        onOpenChange(false);
        onSuccess?.();
      }
    });
  };

  const selectedLocationId = form.watch("location_id");
  const selectedSublocationId = form.watch("sublocation_id");

  // Helper to get locations by type
  const getLocationsByType = useMemo(() => {
    return (type: string, parentId?: string) => {
      return locations.filter(loc => {
        if (loc.type !== type) return false;
        if (parentId && loc.parent_id !== parentId) return false;
        if (!parentId && type !== 'location') return false;
        return true;
      });
    };
  }, [locations]);

  const mainLocations = getLocationsByType('location');
  const sublocations = getLocationsByType('sublocation', selectedLocationId);
  const departments = getLocationsByType('department', selectedSublocationId || selectedLocationId);

  // Get selected location details for capacity warning
  const selectedLocation = selectedLocationId 
    ? locations.find(l => l.id === selectedLocationId)
    : null;
  const selectedSublocation = selectedSublocationId
    ? locations.find(l => l.id === selectedSublocationId)
    : null;

  const getCapacityWarning = (location: WarehouseLocation | null | undefined) => {
    if (!location || !location.capacity) return null;
    
    const usage = (location.current_usage || 0) / location.capacity;
    if (usage > 0.9) {
      return {
        level: 'error' as const,
        message: `Warning: ${location.name} is at ${(usage * 100).toFixed(0)}% capacity!`
      };
    } else if (usage > 0.75) {
      return {
        level: 'warning' as const,
        message: `${location.name} is at ${(usage * 100).toFixed(0)}% capacity`
      };
    }
    return null;
  };

  const locationWarning = getCapacityWarning(selectedLocation);
  const sublocationWarning = getCapacityWarning(selectedSublocation);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">Transfer Asset</DialogTitle>
          <p className="text-sm text-muted-foreground">{assetName}</p>
        </DialogHeader>

        {locationsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">Loading locations...</span>
          </div>
        ) : (
          <>
            {/* Current Location Card */}
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center">
                  <MapPin className="h-4 w-4 mr-2" />
                  Current Location
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-3">
                <div className="text-sm space-y-1">
                  <div>
                    <span className="font-medium">Location:</span> {currentLocation || 'Not assigned'}
                  </div>
                  <div>
                    <span className="font-medium">Sublocation:</span> {currentSublocation || 'Not assigned'}
                  </div>
                  <div>
                    <span className="font-medium">Department:</span> {currentDepartment || 'Not assigned'}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-center py-1">
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm">New Location</CardTitle>
                    <CardDescription className="text-xs">Select where to transfer this asset</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <FormField
                      control={form.control}
                      name="location_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Location</FormLabel>
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
                    
                    {locationWarning && (
                      <Alert variant={locationWarning.level === 'error' ? 'destructive' : 'default'} className="py-2">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription className="text-xs">{locationWarning.message}</AlertDescription>
                      </Alert>
                    )}
                    
                    {selectedLocationId && sublocations.length > 0 && (
                      <FormField
                        control={form.control}
                        name="sublocation_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Sublocation</FormLabel>
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

                    {sublocationWarning && (
                      <Alert variant={sublocationWarning.level === 'error' ? 'destructive' : 'default'} className="py-2">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription className="text-xs">{sublocationWarning.message}</AlertDescription>
                      </Alert>
                    )}

                    {(selectedLocationId || selectedSublocationId) && departments.length > 0 && (
                      <FormField
                        control={form.control}
                        name="department_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Department</FormLabel>
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
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm">Transfer Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <FormField
                      control={form.control}
                      name="transfer_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Transfer Date *</FormLabel>
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
                          <FormLabel className="text-xs">Transfer Reason *</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Department move, Project assignment" {...field} />
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
                          <FormLabel className="text-xs">Notes (Optional)</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Additional notes..." 
                              className="min-h-[60px]"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                <div className="flex justify-end space-x-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    size="sm"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isTransferring} size="sm">
                    {isTransferring && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Transfer Asset
                  </Button>
                </div>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
