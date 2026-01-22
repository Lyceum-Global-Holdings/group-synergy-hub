import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Package, Hash, Calendar, MapPin } from "lucide-react";
import { ITEM_SECTIONS, SERIAL_CONDITIONS, SERIAL_AVAILABILITIES } from "@/types/construction-inventory";
import { useSerialNumbers } from "@/hooks/construction/useConstructionInventory";
import { format } from "date-fns";

interface ItemDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: {
    id: string;
    item_code: string;
    item_name: string;
    category: string;
    section: string;
    brand?: string | null;
    model?: string | null;
    unit_of_measurement: string;
    unit_cost?: number | null;
    description?: string | null;
    status: string;
    image_url?: string | null;
    is_serial_tracked?: boolean;
    created_at?: string;
  } | null;
}

export function ItemDetailsDialog({ open, onOpenChange, item }: ItemDetailsDialogProps) {
  const { data: serialNumbers } = useSerialNumbers();
  
  if (!item) return null;
  
  const itemSerials = serialNumbers?.filter(s => s.item_master_id === item.id) || [];
  const isMachine = item.category === "machines";

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
      scrap: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
      sold: "bg-muted text-muted-foreground",
    };
    return <Badge className={styles[status] || ""}>{status}</Badge>;
  };

  const getConditionLabel = (condition: string) => {
    return SERIAL_CONDITIONS.find(c => c.value === condition)?.label || condition;
  };

  const getAvailabilityBadge = (availability: string) => {
    const styles: Record<string, string> = {
      available: "bg-green-100 text-green-800",
      in_use: "bg-blue-100 text-blue-800",
      under_repair: "bg-yellow-100 text-yellow-800",
      disposed: "bg-red-100 text-red-800",
    };
    const label = SERIAL_AVAILABILITIES.find(a => a.value === availability)?.label || availability;
    return <Badge className={styles[availability] || ""}>{label}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Item Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <div className="flex gap-4">
            {item.image_url ? (
              <img src={item.image_url} alt="" className="h-24 w-24 rounded-lg object-cover" />
            ) : (
              <div className="h-24 w-24 rounded-lg bg-muted flex items-center justify-center">
                <Package className="h-10 w-10 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-semibold">{item.item_name}</h3>
                {getStatusBadge(item.status)}
              </div>
              <p className="text-sm text-muted-foreground font-mono">{item.item_code}</p>
              {item.description && (
                <p className="text-sm text-muted-foreground">{item.description}</p>
              )}
            </div>
          </div>

          <Separator />

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Category</p>
              <p className="font-medium capitalize">{item.category}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Section</p>
              <Badge variant="secondary">
                {ITEM_SECTIONS.find(s => s.value === item.section)?.label || item.section}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Brand</p>
              <p className="font-medium">{item.brand || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Model</p>
              <p className="font-medium">{item.model || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Unit of Measurement</p>
              <p className="font-medium">{item.unit_of_measurement}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Unit Cost</p>
              <p className="font-medium">
                {item.unit_cost ? `₹${item.unit_cost.toLocaleString()}` : "-"}
              </p>
            </div>
            {item.created_at && (
              <div>
                <p className="text-sm text-muted-foreground">Created</p>
                <p className="font-medium flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(item.created_at), "PPP")}
                </p>
              </div>
            )}
          </div>

          {/* Serial Numbers Section (for machines) */}
          {isMachine && (
            <>
              <Separator />
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Hash className="h-4 w-4" />
                  Serial Numbers ({itemSerials.length})
                </h4>
                {itemSerials.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No serial numbers registered</p>
                ) : (
                  <div className="space-y-2">
                    {itemSerials.map(serial => (
                      <div key={serial.id} className="p-3 rounded-lg border bg-muted/30">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono">
                              <Hash className="h-3 w-3 mr-1" />
                              {serial.serial_number}
                            </Badge>
                            {getAvailabilityBadge(serial.availability)}
                          </div>
                          <Badge variant="secondary">{getConditionLabel(serial.condition)}</Badge>
                        </div>
                        <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                          {serial.current_location_id && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              Location assigned
                            </span>
                          )}
                          {serial.warranty_expiry && (
                            <span>
                              Warranty: {format(new Date(serial.warranty_expiry), "PP")}
                            </span>
                          )}
                          {serial.asset_value && (
                            <span>Value: ₹{serial.asset_value.toLocaleString()}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
