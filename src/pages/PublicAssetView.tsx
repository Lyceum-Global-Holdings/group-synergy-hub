import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, Package, MapPin, Calendar, DollarSign, Info, Tag } from 'lucide-react';
import { format } from 'date-fns';

interface PublicAssetData {
  id: string;
  name: string;
  category: string;
  brand: string | null;
  asset_id: string | null;
  serial_number: string | null;
  asset_tag: string | null;
  condition: string;
  status: string;
  purchase_date: string | null;
  purchase_price: number | null;
  current_value: number | null;
  description: string | null;
  notes: string | null;
  location_id: string | null;
  sublocation_id: string | null;
  department_id: string | null;
  category_id: string | null;
  subcategory_id: string | null;
}

const getConditionBadge = (condition: string) => {
  switch (condition) {
    case 'good': return 'bg-green-100 text-green-800 hover:bg-green-100';
    case 'fair': return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100';
    case 'poor': return 'bg-red-100 text-red-800 hover:bg-red-100';
    case 'needs_repair': return 'bg-orange-100 text-orange-800 hover:bg-orange-100';
    default: return 'bg-gray-100 text-gray-800 hover:bg-gray-100';
  }
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'active': return 'bg-green-100 text-green-800 hover:bg-green-100';
    case 'inactive': return 'bg-gray-100 text-gray-800 hover:bg-gray-100';
    case 'maintenance': return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100';
    case 'disposed': return 'bg-red-100 text-red-800 hover:bg-red-100';
    default: return 'bg-gray-100 text-gray-800 hover:bg-gray-100';
  }
};

export default function PublicAssetView() {
  const { assetId } = useParams<{ assetId: string }>();

  const { data: asset, isLoading, error } = useQuery({
    queryKey: ['public-asset', assetId],
    queryFn: async () => {
      if (!assetId) return null;

      const { data, error } = await supabase
        .from('warehouse_assets')
        .select(`
          id,
          name,
          category,
          brand,
          asset_id,
          serial_number,
          asset_tag,
          condition,
          status,
          purchase_date,
          purchase_price,
          current_value,
          description,
          notes
        `)
        .eq('id', assetId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching public asset:', error);
        throw error;
      }
      return data as PublicAssetData | null;
    },
    enabled: !!assetId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
              <div>
                <h3 className="text-lg font-semibold">Loading Asset</h3>
                <p className="text-sm text-muted-foreground">
                  Please wait while we fetch the asset information...
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                <Package className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-destructive">Error Loading Asset</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  There was a problem loading the asset information.
                </p>
                <p className="text-xs text-muted-foreground">
                  Error: {error.message}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <Package className="h-12 w-12 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold">Asset Not Found</h3>
                <p className="text-sm text-muted-foreground">
                  The requested asset could not be found. Please check the QR code or link and try again.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Asset Details</h1>
            <p className="text-muted-foreground">Public view of asset information</p>
          </div>

          {/* Main Asset Info */}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div>
                  <CardTitle className="text-2xl">{asset.name}</CardTitle>
                  <p className="text-muted-foreground mt-1">{asset.category}</p>
                </div>
                <div className="flex gap-2">
                  <Badge className={getStatusBadge(asset.status)}>
                    {asset.status.charAt(0).toUpperCase() + asset.status.slice(1)}
                  </Badge>
                  <Badge className={getConditionBadge(asset.condition)}>
                    {asset.condition.charAt(0).toUpperCase() + asset.condition.slice(1)}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Identification</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {asset.asset_id && (
                      <>
                        <span className="text-muted-foreground">Asset ID:</span>
                        <span className="font-mono">{asset.asset_id}</span>
                      </>
                    )}
                    {asset.serial_number && (
                      <>
                        <span className="text-muted-foreground">Serial Number:</span>
                        <span className="font-mono">{asset.serial_number}</span>
                      </>
                    )}
                    {asset.asset_tag && (
                      <>
                        <span className="text-muted-foreground">Asset Tag:</span>
                        <span className="font-mono">{asset.asset_tag}</span>
                      </>
                    )}
                    {asset.brand && (
                      <>
                        <span className="text-muted-foreground">Brand:</span>
                        <span>{asset.brand}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Location</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <span className="text-muted-foreground">Location:</span>
                    <span>Not specified</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Financial Information */}
              {(asset.purchase_price || asset.current_value || asset.purchase_date) && (
                <>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Financial Information</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      {asset.purchase_price && (
                        <div>
                          <span className="text-muted-foreground block">Purchase Price</span>
                          <span className="text-lg font-semibold">${asset.purchase_price.toLocaleString()}</span>
                        </div>
                      )}
                      {asset.current_value && (
                        <div>
                          <span className="text-muted-foreground block">Current Value</span>
                          <span className="text-lg font-semibold">${asset.current_value.toLocaleString()}</span>
                        </div>
                      )}
                      {asset.purchase_date && (
                        <div>
                          <span className="text-muted-foreground block">Purchase Date</span>
                          <span className="text-lg font-semibold">
                            {format(new Date(asset.purchase_date), 'MMM dd, yyyy')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              {/* Description & Notes */}
              {(asset.description || asset.notes) && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Additional Information</span>
                  </div>
                  {asset.description && (
                    <div>
                      <span className="text-sm text-muted-foreground block mb-1">Description</span>
                      <p className="text-sm leading-relaxed">{asset.description}</p>
                    </div>
                  )}
                  {asset.notes && (
                    <div>
                      <span className="text-sm text-muted-foreground block mb-1">Notes</span>
                      <p className="text-sm leading-relaxed">{asset.notes}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="text-center text-sm text-muted-foreground">
            <p>This is a public view of asset information. For full access, please contact your administrator.</p>
          </div>
        </div>
      </div>
    </div>
  );
}