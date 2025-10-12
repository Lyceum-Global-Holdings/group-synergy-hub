import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Edit, Calendar, DollarSign, MapPin, Package, Tag, 
  TrendingDown, Clock, Activity, BarChart3, 
  ArrowRightLeft, AlertCircle, CheckCircle, 
  Calculator, Target, History
} from "lucide-react";
import { WarehouseAsset, WarehouseLocation, AssetCategory } from "@/types/warehouse";
import { useAssetTransfers } from "@/hooks/useAssetTransfers";
import { format, differenceInDays, differenceInCalendarDays } from "date-fns";
import AssetQRCode from "./AssetQRCode";

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
  const { data: transfers = [], isLoading: transfersLoading } = useAssetTransfers(asset?.id);

  if (!asset) return null;

  // Calculate analytics
  const daysInUse = asset.purchase_date 
    ? differenceInCalendarDays(new Date(), new Date(asset.purchase_date))
    : null;

  const assetAge = asset.created_at 
    ? differenceInCalendarDays(new Date(), new Date(asset.created_at))
    : 0;

  const depreciationAmount = asset.purchase_price && asset.current_value
    ? Number(asset.purchase_price) - Number(asset.current_value)
    : null;

  const depreciationPercentage = asset.purchase_price && depreciationAmount
    ? (depreciationAmount / Number(asset.purchase_price)) * 100
    : null;

  const costPerDay = asset.purchase_price && daysInUse && daysInUse > 0
    ? Number(asset.purchase_price) / daysInUse
    : null;

  const residualValuePercentage = asset.purchase_price && asset.current_value
    ? (Number(asset.current_value) / Number(asset.purchase_price)) * 100
    : null;

  const lastTransfer = transfers[0];
  const daysSinceLastTransfer = lastTransfer
    ? differenceInCalendarDays(new Date(), new Date(lastTransfer.transfer_date))
    : null;

  const transferCount = transfers.length;
  const transfersPerYear = daysInUse && daysInUse > 0 
    ? (transferCount / daysInUse) * 365
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              <span>{asset.name}</span>
              <Badge variant="outline" className="font-mono text-xs">
                {asset.asset_id || 'Auto-generated'}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <AssetQRCode assetId={asset.id} assetName={asset.name} assetIdentifier={asset.asset_id} />
              <Button
                variant="outline"  
                size="sm"
                onClick={() => {
                  onEdit(asset);
                  onOpenChange(false);
                }}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Asset
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="transfers">Transfer History</TabsTrigger>
            <TabsTrigger value="financial">Financial</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Asset Analytics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Days in Use</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {daysInUse !== null ? daysInUse : 'N/A'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {daysInUse !== null ? `Since ${format(new Date(asset.purchase_date!), 'MMM yyyy')}` : 'No purchase date'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Current Value</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {asset.current_value ? `Rs. ${Number(asset.current_value).toLocaleString()}` : 'N/A'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {residualValuePercentage !== null 
                      ? `${residualValuePercentage.toFixed(1)}% of purchase price`
                      : 'No purchase price data'
                    }
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Transfer Count</CardTitle>
                  <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{transferCount}</div>
                  <p className="text-xs text-muted-foreground">
                    {transfersPerYear > 0 
                      ? `${transfersPerYear.toFixed(1)} per year`
                      : 'No transfers recorded'
                    }
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Package className="h-5 w-5" />
                Basic Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
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

            {/* Current Location & Status */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Current Location & Status
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Location</label>
                  <p className="mt-1">{getLocationName(asset.location_id) || 'Not assigned'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Department</label>
                  <p className="mt-1">{getLocationName(asset.department_id) || 'Not assigned'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Condition</label>
                  <div className="mt-1">
                    <Badge variant="outline" className={getConditionBadge(asset.condition)}>
                      {asset.condition.replace('_', ' ')}
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

            {/* Description & Notes */}
            {(asset.description || asset.notes) && (
              <>
                <Separator />
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
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            {/* Asset Condition Analytics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Asset Analytics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Asset Age</label>
                    <p className="text-lg font-semibold">{assetAge} days</p>
                    <p className="text-xs text-muted-foreground">Since creation</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Days Since Last Transfer</label>
                    <p className="text-lg font-semibold">
                      {daysSinceLastTransfer !== null ? `${daysSinceLastTransfer} days` : 'No transfers'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {lastTransfer ? format(new Date(lastTransfer.transfer_date), 'MMM dd, yyyy') : 'Never transferred'}
                    </p>
                  </div>
                </div>

                {depreciationPercentage !== null && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Depreciation</label>
                    <div className="mt-2">
                      <Progress value={depreciationPercentage} className="h-2" />
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>0%</span>
                        <span className="font-medium">{depreciationPercentage.toFixed(1)}% depreciated</span>
                        <span>100%</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Usage Patterns */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Usage Patterns
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Transfer Frequency</label>
                    <p className="text-lg font-semibold">
                      {transfersPerYear > 0 ? `${transfersPerYear.toFixed(1)}/year` : 'No transfers'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Current Location Duration</label>
                    <p className="text-lg font-semibold">
                      {daysSinceLastTransfer !== null ? `${daysSinceLastTransfer} days` : `${assetAge} days`}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="transfers" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Transfer History ({transferCount} transfers)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {transfersLoading ? (
                  <p className="text-center text-muted-foreground py-4">Loading transfer history...</p>
                ) : transfers.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8 space-y-2">
                    <ArrowRightLeft className="h-12 w-12 mx-auto opacity-50" />
                    <p>No transfers recorded</p>
                    <p className="text-sm">This asset has remained at its original location</p>
                  </div>
                 ) : (
                  <div className="space-y-4">
                    {transfers.map((transfer, index) => {
                      // Build complete location paths
                      const fromLocationPath = [
                        getLocationName(transfer.from_location_id),
                        getLocationName(transfer.from_sublocation_id),
                        getLocationName(transfer.from_department_id)
                      ].filter(Boolean).join(' → ');
                      
                      const toLocationPath = [
                        getLocationName(transfer.to_location_id),
                        getLocationName(transfer.to_sublocation_id),
                        getLocationName(transfer.to_department_id)
                      ].filter(Boolean).join(' → ');

                      return (
                        <div key={transfer.id} className="flex items-start gap-3 p-4 border rounded-lg bg-muted/30">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <ArrowRightLeft className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-grow space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="space-y-1">
                                <p className="font-medium text-sm">
                                  <span className="text-muted-foreground">From:</span> {fromLocationPath || 'Unknown Location'}
                                </p>
                                <p className="font-medium text-sm">
                                  <span className="text-muted-foreground">To:</span> {toLocationPath || 'Unknown Location'}
                                </p>
                              </div>
                              <div className="text-right">
                                <span className="text-sm font-medium">
                                  {format(new Date(transfer.transfer_date), 'MMM dd, yyyy')}
                                </span>
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(transfer.transfer_date), 'h:mm a')}
                                </p>
                              </div>
                            </div>
                            
                            {transfer.transfer_reason && (
                              <div className="bg-background/50 p-2 rounded text-sm">
                                <span className="font-medium text-muted-foreground">Reason:</span> {transfer.transfer_reason}
                              </div>
                            )}
                            
                            {transfer.notes && (
                              <div className="bg-background/50 p-2 rounded text-sm">
                                <span className="font-medium text-muted-foreground">Notes:</span> {transfer.notes}
                              </div>
                            )}
                            
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>Transfer #{index + 1}</span>
                              {transfer.transferred_by && (
                                <>
                                  <span>•</span>
                                  <span>By: User {transfer.transferred_by.slice(0, 8)}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="financial" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Purchase Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Purchase Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
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
                    <p className="text-2xl font-bold">
                      {asset.purchase_price 
                        ? `Rs. ${Number(asset.purchase_price).toLocaleString()}`
                        : 'Not specified'
                      }
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Financial Analytics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5" />
                    Financial Analytics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {costPerDay && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Cost per Day</label>
                      <p className="text-lg font-semibold">Rs. {costPerDay.toFixed(2)}</p>
                    </div>
                  )}
                  
                  {depreciationAmount && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Total Depreciation</label>
                      <p className="text-lg font-semibold text-red-600">
                        -Rs. {depreciationAmount.toLocaleString()}
                      </p>
                    </div>
                  )}

                  {asset.current_value && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Current Value</label>
                      <p className="text-2xl font-bold">
                        Rs. {Number(asset.current_value).toLocaleString()}
                      </p>
                      {residualValuePercentage && (
                        <p className="text-sm text-muted-foreground">
                          {residualValuePercentage.toFixed(1)}% of original value
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="pt-4 border-t">
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
      </DialogContent>
    </Dialog>
  );
}