import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, Package, MapPin, Calendar, Info, Tag, Clock, Building2 } from 'lucide-react';
import { format } from 'date-fns';

interface PublicAssetData {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  brand: string | null;
  asset_id: string | null;
  serial_number: string | null;
  asset_tag: string | null;
  condition: string;
  status: string;
  purchase_date: string | null;
  description: string | null;
  notes: string | null;
  location: string | null;
  sublocation: string | null;
  department: string | null;
  asset_age_years: number | null;
  asset_age_months: number | null;
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

const formatCondition = (condition: string) => {
  return condition
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const formatAssetAge = (years: number | null, months: number | null) => {
  if (years === null || months === null) return 'Unknown';
  
  const parts = [];
  if (years > 0) parts.push(`${years} year${years !== 1 ? 's' : ''}`);
  if (months > 0) parts.push(`${months} month${months !== 1 ? 's' : ''}`);
  
  if (parts.length === 0) return 'Less than a month';
  return parts.join(', ');
};

export default function PublicAssetView() {
  const { assetId } = useParams<{ assetId: string }>();

  const { data: asset, isLoading, error } = useQuery({
    queryKey: ['public-asset', assetId],
    queryFn: async () => {
      if (!assetId) return null;

      console.log('Fetching public asset data for ID:', assetId);
      
      const { data, error } = await supabase.rpc('get_public_asset', {
        p_id: assetId
      });

      if (error) {
        console.error('Error fetching public asset:', error);
        throw error;
      }
      
      console.log('Public asset data received:', data);
      
      // RPC returns null if no asset found
      if (!data) return null;
      
      // The RPC function returns a JSON object, so we need to type it properly
      return data as unknown as PublicAssetData;
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
                  <div className="flex flex-wrap gap-2 mt-2">
                    {asset.category && (
                      <span className="text-muted-foreground">{asset.category}</span>
                    )}
                    {asset.subcategory && (
                      <span className="text-muted-foreground">/ {asset.subcategory}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Badge className={getStatusBadge(asset.status)}>
                    {asset.status.charAt(0).toUpperCase() + asset.status.slice(1)}
                  </Badge>
                  <Badge className={getConditionBadge(asset.condition)}>
                    {formatCondition(asset.condition)}
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
                    <span className="text-muted-foreground">Category:</span>
                    <span>{asset.category || 'Not specified'}</span>
                    {asset.subcategory && (
                      <>
                        <span className="text-muted-foreground">Subcategory:</span>
                        <span>{asset.subcategory}</span>
                      </>
                    )}
                    <span className="text-muted-foreground">Brand:</span>
                    <span>{asset.brand || 'Not specified'}</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Location</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <span className="text-muted-foreground">Location:</span>
                    <span>{asset.location || 'Not specified'}</span>
                    <span className="text-muted-foreground">Sublocation:</span>
                    <span>{asset.sublocation || 'Not specified'}</span>
                    <span className="text-muted-foreground">Department:</span>
                    <span>{asset.department || 'Not specified'}</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Status & Condition */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Status & Condition</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <span className="text-muted-foreground">Status:</span>
                    <Badge className={getStatusBadge(asset.status)}>
                      {asset.status.charAt(0).toUpperCase() + asset.status.slice(1)}
                    </Badge>
                    <span className="text-muted-foreground">Condition:</span>
                    <Badge className={getConditionBadge(asset.condition)}>
                      {formatCondition(asset.condition)}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Asset Age</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <span className="text-muted-foreground">Age:</span>
                    <span className="font-semibold">
                      {formatAssetAge(asset.asset_age_years, asset.asset_age_months)}
                    </span>
                    {asset.purchase_date && (
                      <>
                        <span className="text-muted-foreground">Purchase Date:</span>
                        <span>{format(new Date(asset.purchase_date), 'MMM dd, yyyy')}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Description & Notes */}
              {(asset.description || asset.notes) && (
                <>
                  <Separator />
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
                </>
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
