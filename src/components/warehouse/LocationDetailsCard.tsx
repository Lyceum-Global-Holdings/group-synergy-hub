import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building, MapPin, Users, Phone, MapPinned, Package, TrendingUp } from 'lucide-react';
import { WarehouseLocation } from '@/types/warehouse';

interface LocationDetailsCardProps {
  location: WarehouseLocation;
  itemCount?: number;
  assetCount?: number;
}

export function LocationDetailsCard({ location, itemCount = 0, assetCount = 0 }: LocationDetailsCardProps) {
  const getTypeIcon = () => {
    switch (location.type) {
      case 'location':
        return <Building className="h-5 w-5" />;
      case 'sublocation':
        return <MapPin className="h-5 w-5" />;
      case 'department':
        return <Users className="h-5 w-5" />;
    }
  };

  const getStatusBadge = () => {
    const statusColors = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800',
      maintenance: 'bg-yellow-100 text-yellow-800',
      closed: 'bg-red-100 text-red-800',
    };
    
    const status = location.status || 'active';
    return (
      <Badge className={statusColors[status as keyof typeof statusColors]}>
        {status}
      </Badge>
    );
  };

  const utilizationPercentage = location.capacity && location.current_usage
    ? (location.current_usage / location.capacity) * 100
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getTypeIcon()}
            {location.name}
          </div>
          {getStatusBadge()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {location.location_code && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Location Code</span>
            <span className="font-mono font-medium">{location.location_code}</span>
          </div>
        )}

        {location.description && (
          <div>
            <span className="text-sm text-muted-foreground">Description</span>
            <p className="text-sm mt-1">{location.description}</p>
          </div>
        )}

        {location.physical_address && (
          <div className="flex items-start gap-2">
            <MapPinned className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <span className="text-sm text-muted-foreground">Address</span>
              <p className="text-sm mt-1">{location.physical_address}</p>
            </div>
          </div>
        )}

        {(location.contact_person || location.contact_phone) && (
          <div className="flex items-start gap-2">
            <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <span className="text-sm text-muted-foreground">Contact</span>
              {location.contact_person && (
                <p className="text-sm mt-1 font-medium">{location.contact_person}</p>
              )}
              {location.contact_phone && (
                <p className="text-sm text-muted-foreground">{location.contact_phone}</p>
              )}
            </div>
          </div>
        )}

        {location.capacity && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Package className="h-4 w-4" />
                Storage Capacity
              </span>
              <span className="text-sm font-medium">
                {location.current_usage || 0} / {location.capacity} units
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${
                  utilizationPercentage > 90
                    ? 'bg-red-500'
                    : utilizationPercentage > 70
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(utilizationPercentage, 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-muted-foreground">
                {utilizationPercentage.toFixed(1)}% utilized
              </span>
              {utilizationPercentage > 90 && (
                <span className="text-xs text-red-600 font-medium">Near Capacity!</span>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-2xl font-bold">{itemCount}</div>
              <div className="text-xs text-muted-foreground">Items Stored</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-2xl font-bold">{assetCount}</div>
              <div className="text-xs text-muted-foreground">Assets</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}