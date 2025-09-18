import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Edit, Calendar, DollarSign, MapPin, Package, Tag } from "lucide-react";
import { WarehouseAsset, WarehouseLocation, AssetCategory } from "@/types/warehouse";
import { format } from "date-fns";

interface AssetDetailsDialogProps {
  asset: WarehouseAsset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (asset: WarehouseAsset) => void;
  locations: WarehouseLocation[];
  categories: AssetCategory[];
  getLocationName: (locationId: string | null) => string;
  getCategoryName: (categoryId: string | null) => string;
  getSubcategoryName: (subcategoryId: string | null) => string;
}

const getConditionBadge = (condition: string) => {
  switch (condition) {
    case 'good':
      return 'bg-green-500/10 text-green-500 border-green-500/20';
    case 'fair':
      return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
    case 'poor':
      return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
    case 'needs_repair':
      return 'bg-red-500/10 text-red-500 border-red-500/20';
    default:
      return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
  }
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'active':
      return 'bg-green-500/10 text-green-500 border-green-500/20';
    case 'inactive':
      return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    case 'maintenance':
      return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
    case 'disposed':
      return 'bg-red-500/10 text-red-500 border-red-500/20';
    default:
      return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
  }
};

export function AssetDetailsDialog({
  asset,
  open,
  onOpenChange,
  onEdit,
  locations,
  categories,
  getLocationName,
  getCategoryName,
  getSubcategoryName,
}: AssetDetailsDialogProps) {
  if (!asset) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Asset Details</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onEdit(asset);
                onOpenChange(false);
              }}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Basic Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Asset ID</label>
                <div className="flex items-center mt-1">
                  <Tag className="h-4 w-4 mr-2 text-muted-foreground" />
                  <span className="font-mono">{asset.asset_id || 'Auto-generated'}</span>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Asset Name</label>
                <div className="flex items-center mt-1">
                  <Package className="h-4 w-4 mr-2 text-muted-foreground" />
                  <span>{asset.name}</span>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Category</label>
                <p className="mt-1">{getCategoryName(asset.category_id)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Subcategory</label>
                <p className="mt-1">{getSubcategoryName(asset.subcategory_id) || 'None'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Brand</label>
                <p className="mt-1">{asset.brand || 'Not specified'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Serial Number</label>
                <p className="mt-1 font-mono">{asset.serial_number || 'Not specified'}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Location Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Location Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Location</label>
                <div className="flex items-center mt-1">
                  <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
                  <span>{getLocationName(asset.location_id) || 'Not assigned'}</span>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Sublocation</label>
                <p className="mt-1">{getLocationName(asset.sublocation_id) || 'Not assigned'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Department</label>
                <p className="mt-1">{getLocationName(asset.department_id) || 'Not assigned'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Asset Tag</label>
                <p className="mt-1 font-mono">{asset.asset_tag || 'Not assigned'}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Status Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Status Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Condition</label>
                <div className="mt-1">
                  <Badge variant="outline" className={getConditionBadge(asset.condition)}>
                    {asset.condition}
                  </Badge>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Status</label>
                <div className="mt-1">
                  <Badge variant="outline" className={getStatusBadge(asset.status)}>
                    {asset.status}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Financial Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Financial Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Purchase Date</label>
                <div className="flex items-center mt-1">
                  <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                  <span>
                    {asset.purchase_date 
                      ? format(new Date(asset.purchase_date), 'PPP')
                      : 'Not specified'
                    }
                  </span>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Purchase Price</label>
                <div className="flex items-center mt-1">
                  <DollarSign className="h-4 w-4 mr-2 text-muted-foreground" />
                  <span>
                    {asset.purchase_price 
                      ? `$${Number(asset.purchase_price).toLocaleString()}`
                      : 'Not specified'
                    }
                  </span>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Current Value</label>
                <div className="flex items-center mt-1">
                  <DollarSign className="h-4 w-4 mr-2 text-muted-foreground" />
                  <span>
                    {asset.current_value 
                      ? `$${Number(asset.current_value).toLocaleString()}`
                      : 'Not specified'
                    }
                  </span>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Additional Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Additional Information</h3>
            {asset.description && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Description</label>
                <p className="mt-1 text-sm bg-muted p-3 rounded-md">{asset.description}</p>
              </div>
            )}
            {asset.notes && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Notes</label>
                <p className="mt-1 text-sm bg-muted p-3 rounded-md">{asset.notes}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
              <div>
                <label className="font-medium">Created</label>
                <p>{format(new Date(asset.created_at), 'PPp')}</p>
              </div>
              <div>
                <label className="font-medium">Last Updated</label>
                <p>{format(new Date(asset.updated_at), 'PPp')}</p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}