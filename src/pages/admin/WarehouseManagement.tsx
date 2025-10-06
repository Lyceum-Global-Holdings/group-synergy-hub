import { useState } from 'react';
import { Warehouse, MapPin, Users, Building, Search, Filter, Plus, Edit2, Trash2, Phone, MapPinned } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useWarehouseLocations } from '@/hooks/useWarehouseLocations';
import { LocationManagementDialog } from '@/components/warehouse/LocationManagementDialog';
import { LocationAnalytics } from '@/components/warehouse/LocationAnalytics';
import { LocationUtilizationChart } from '@/components/warehouse/LocationUtilizationChart';
import { ImportLocationsDialog } from '@/components/warehouse/ImportLocationsDialog';
import { LocationTemplateDialog } from '@/components/warehouse/LocationTemplateDialog';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function WarehouseManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  const { locations, isLoading, deleteLocation, isDeleting } = useWarehouseLocations();
  const { toast } = useToast();

  // Calculate statistics
  const stats = {
    totalLocations: locations.filter(l => l.type === 'location').length,
    totalSublocations: locations.filter(l => l.type === 'sublocation').length,
    totalDepartments: locations.filter(l => l.type === 'department').length,
    activeLocations: locations.filter(l => l.status === 'active').length,
  };

  // Filter locations
  const filteredLocations = locations.filter(location => {
    const matchesSearch = location.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      location.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      location.location_code?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = typeFilter === 'all' || location.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || location.status === statusFilter;

    return matchesSearch && matchesType && matchesStatus;
  });

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      try {
        await deleteLocation(id);
        toast({
          title: 'Location deleted',
          description: `${name} has been successfully deleted.`,
        });
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to delete location. It may have associated items.',
          variant: 'destructive',
        });
      }
    }
  };

  const getStatusBadge = (status?: string) => {
    const statusColors = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800',
      maintenance: 'bg-yellow-100 text-yellow-800',
      closed: 'bg-red-100 text-red-800',
    };
    
    const displayStatus = status || 'active';
    return (
      <Badge className={statusColors[displayStatus as keyof typeof statusColors] || statusColors.active}>
        {displayStatus}
      </Badge>
    );
  };

  const getTypeBadge = (type: string) => {
    const typeColors = {
      location: 'bg-blue-100 text-blue-800',
      sublocation: 'bg-green-100 text-green-800',
      department: 'bg-orange-100 text-orange-800',
    };
    
    const typeIcons = {
      location: Building,
      sublocation: MapPin,
      department: Users,
    };
    
    const Icon = typeIcons[type as keyof typeof typeIcons];
    
    return (
      <Badge className={typeColors[type as keyof typeof typeColors]}>
        {Icon && <Icon className="h-3 w-3 mr-1" />}
        {type}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading warehouse locations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Warehouse className="h-8 w-8" />
            Warehouse Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage warehouse locations, sublocations, and departments
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ImportLocationsDialog />
          <LocationTemplateDialog />
          <LocationManagementDialog />
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Locations</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalLocations}</div>
            <p className="text-xs text-muted-foreground">Main warehouse locations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sublocations</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSublocations}</div>
            <p className="text-xs text-muted-foreground">Storage sublocations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Departments</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalDepartments}</div>
            <p className="text-xs text-muted-foreground">Department areas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <Warehouse className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeLocations}</div>
            <p className="text-xs text-muted-foreground">Currently operational</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filter & Search</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search locations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="location">Location</SelectItem>
                <SelectItem value="sublocation">Sublocation</SelectItem>
                <SelectItem value="department">Department</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for different views */}
      <Tabs defaultValue="locations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="locations">Locations</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="utilization">Utilization Chart</TabsTrigger>
        </TabsList>

        <TabsContent value="locations" className="space-y-4">
          {/* Locations Table */}
          <Card>
        <CardHeader>
          <CardTitle>Warehouse Locations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLocations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No locations found. Click "Manage Locations" to add one.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLocations.map((location) => (
                    <TableRow key={location.id}>
                      <TableCell className="font-mono text-sm">
                        {location.location_code || '-'}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{location.name}</div>
                          {location.description && (
                            <div className="text-sm text-muted-foreground">
                              {location.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getTypeBadge(location.type)}</TableCell>
                      <TableCell>{getStatusBadge(location.status)}</TableCell>
                      <TableCell>
                        {location.contact_person ? (
                          <div className="text-sm">
                            <div className="font-medium">{location.contact_person}</div>
                            {location.contact_phone && (
                              <div className="text-muted-foreground flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {location.contact_phone}
                              </div>
                            )}
                          </div>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        {location.capacity ? `${location.capacity} units` : '-'}
                      </TableCell>
                      <TableCell>
                        {location.current_usage !== undefined && location.capacity ? (
                          <div>
                            <div className="text-sm font-medium">
                              {((location.current_usage / location.capacity) * 100).toFixed(1)}%
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {location.current_usage} / {location.capacity}
                            </div>
                          </div>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        {location.physical_address ? (
                          <div className="text-sm flex items-start gap-1 max-w-xs">
                            <MapPinned className="h-3 w-3 mt-0.5 flex-shrink-0" />
                            <span className="truncate">{location.physical_address}</span>
                          </div>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(location.id, location.name)}
                            disabled={isDeleting}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <LocationAnalytics />
        </TabsContent>

        <TabsContent value="utilization">
          <LocationUtilizationChart />
        </TabsContent>
      </Tabs>
    </div>
  );
}