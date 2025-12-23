import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useWarehouseLocations } from '@/hooks/useWarehouseLocations';
import { useWarehouseBins } from '@/hooks/useWarehouseBins';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Building, MapPin, Phone, Users, Package, Grid3x3 } from 'lucide-react';

interface LocationDetailsDialogProps {
  locationId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LocationDetailsDialog({ locationId, open, onOpenChange }: LocationDetailsDialogProps) {
  const { locations } = useWarehouseLocations();
  const { bins } = useWarehouseBins();

  const location = locations.find(l => l.id === locationId);
  const locationBins = bins.filter(b => b.location_id === locationId);

  if (!location) return null;

  const utilizationPercent = location.capacity 
    ? ((location.current_usage || 0) / location.capacity * 100).toFixed(1)
    : '0';

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      case 'maintenance': return 'bg-yellow-100 text-yellow-800';
      case 'closed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            {location.name}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="overview" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="bins">Bins ({locationBins.length})</TabsTrigger>
            <TabsTrigger value="capacity">Capacity</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Location Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Location Code</div>
                    <div className="font-mono">{location.location_code || '-'}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Type</div>
                    <Badge variant="outline">{location.type}</Badge>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Status</div>
                    <Badge className={getStatusColor(location.status)}>
                      {location.status || 'active'}
                    </Badge>
                  </div>
                  {location.description && (
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">Description</div>
                      <div className="text-sm">{location.description}</div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Contact Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {location.contact_person && (
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">{location.contact_person}</div>
                      </div>
                    </div>
                  )}
                  {location.contact_phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <div className="text-sm">{location.contact_phone}</div>
                    </div>
                  )}
                  {location.physical_address && (
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div className="text-sm">{location.physical_address}</div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Capacity Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-2xl font-bold">{location.capacity || 0}</div>
                    <div className="text-sm text-muted-foreground">Total Capacity</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{location.current_usage || 0}</div>
                    <div className="text-sm text-muted-foreground">Current Usage</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{utilizationPercent}%</div>
                    <div className="text-sm text-muted-foreground">Utilization</div>
                  </div>
                </div>
                <div className="mt-4 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${
                      parseFloat(utilizationPercent) >= 90 ? 'bg-red-500' :
                      parseFloat(utilizationPercent) >= 70 ? 'bg-yellow-500' :
                      'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(parseFloat(utilizationPercent), 100)}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bins">
            {locationBins.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No bins associated with this location
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Bin Code</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Capacity</TableHead>
                        <TableHead>Current Qty</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {locationBins.map((bin) => (
                        <TableRow key={bin.id}>
                          <TableCell className="font-mono text-sm">{bin.bin_code}</TableCell>
                          <TableCell>{bin.name}</TableCell>
                          <TableCell>{bin.capacity || '-'}</TableCell>
                          <TableCell>{bin.current_quantity || 0}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{bin.status}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="capacity">
            <Card>
              <CardHeader>
                <CardTitle>Capacity Analysis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
                      <Grid3x3 className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Total Bins</div>
                      <div className="text-2xl font-bold">{locationBins.length}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center">
                      <Package className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Bin Capacity</div>
                      <div className="text-2xl font-bold">
                        {locationBins.reduce((sum, b) => sum + (b.capacity || 0), 0)}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium mb-2">Space Utilization</div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Used: {location.current_usage || 0} units</span>
                      <span>Available: {(location.capacity || 0) - (location.current_usage || 0)} units</span>
                    </div>
                    <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all ${
                          parseFloat(utilizationPercent) >= 90 ? 'bg-red-500' :
                          parseFloat(utilizationPercent) >= 70 ? 'bg-yellow-500' :
                          'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(parseFloat(utilizationPercent), 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>0%</span>
                      <span>50%</span>
                      <span>100%</span>
                    </div>
                  </div>
                </div>

                {parseFloat(utilizationPercent) >= 90 && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="font-medium text-red-900">High Utilization Warning</div>
                    <div className="text-sm text-red-700 mt-1">
                      This location is at {utilizationPercent}% capacity. Consider reallocating items or expanding capacity.
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
