import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Warehouse, MapPin, Users, Building, Search, Filter, Plus, Edit2, Trash2, Phone, MapPinned, Eye, Download, FileText, ChevronsUpDown } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useWarehouseLocations } from '@/hooks/useWarehouseLocations';
import { LocationManagementDialog } from '@/components/warehouse/LocationManagementDialog';
import { LocationAnalytics } from '@/components/warehouse/LocationAnalytics';
import { LocationUtilizationChart } from '@/components/warehouse/LocationUtilizationChart';
import { ImportLocationsDialog } from '@/components/warehouse/ImportLocationsDialog';
import { LocationTemplateDialog } from '@/components/warehouse/LocationTemplateDialog';
import { BinMasterTab } from '@/components/warehouse/BinMasterTab';
import { LocationDetailsDialog } from '@/components/warehouse/LocationDetailsDialog';
import { LocationHierarchyTab } from '@/components/warehouse/LocationHierarchyTab';
import { CapacityPlanningTab } from '@/components/warehouse/CapacityPlanningTab';
import { useToast } from '@/hooks/use-toast';
import { useCompanies } from '@/hooks/useCompanies';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useLocationCompanies } from '@/hooks/useLocationCompanies';

type WarehouseLocation = typeof import('@/hooks/useWarehouseLocations') extends { useWarehouseLocations: () => { locations: (infer T)[] } } ? T : any;

export default function WarehouseManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [detailsLocationId, setDetailsLocationId] = useState<string | null>(null);
  const [editLocationData, setEditLocationData] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<Record<string, any>>({});

  const {
    locations,
    isLoading,
    deleteLocationAsync,
    updateLocationAsync,
    bulkDeleteLocations,
    bulkUpdateStatus,
    isDeleting,
    isUpdating,
  } = useWarehouseLocations();
  const { toast } = useToast();
  const { companies } = useCompanies();
  const { companyIds: editLocationCompanyIds, assignments: editAssignments, saveCompanies } = useLocationCompanies(editLocationData?.id);

  // Admin master-data view: fetch FULL location-company mappings via security-definer RPC,
  // bypassing per-company RLS so admins see every allocation chip (ISO/IEC 27001 A.9.4.1).
  const { data: allLocationCompanyMap = {} } = useQuery({
    queryKey: ['all-location-companies-admin'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_all_warehouse_location_companies');
      if (error) throw error;
      const map: Record<string, string[]> = {};
      for (const row of (data || []) as Array<{ location_id: string; company_id: string }>) {
        if (!map[row.location_id]) map[row.location_id] = [];
        map[row.location_id].push(row.company_id);
      }
      return map;
    },
  });

  // Effective (resolved + inheritance-aware) company assignments per location — the
  // canonical source for chip rendering. Aligns with SAP EWM hierarchy practice.
  const { data: allEffectiveMap = {} } = useQuery({
    queryKey: ['all-effective-location-companies-admin'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_all_effective_location_companies' as any);
      if (error) throw error;
      const map: Record<string, Array<{ company_id: string; is_inherited: boolean; source_location_id: string }>> = {};
      for (const row of (data || []) as any[]) {
        if (!map[row.location_id]) map[row.location_id] = [];
        map[row.location_id].push({
          company_id: row.company_id,
          is_inherited: row.is_inherited,
          source_location_id: row.source_location_id,
        });
      }
      return map;
    },
  });

  // Admin-scoped minimal company directory (id, name, code) for chip labelling.
  // Falls back to useCompanies() — kept RLS-scoped for transactional surfaces.
  const { data: allCompaniesMinimal = [] } = useQuery({
    queryKey: ['all-companies-minimal-admin'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_all_companies_minimal');
      if (error) throw error;
      return (data || []) as Array<{ id: string; name: string; code: string | null }>;
    },
  });

  const companyLookup = useMemo(() => {
    const m = new Map<string, { name: string; code: string | null }>();
    for (const c of allCompaniesMinimal) m.set(c.id, { name: c.name, code: c.code });
    for (const c of companies) {
      if (!m.has(c.id)) m.set(c.id, { name: c.name, code: (c as any).code ?? null });
    }
    return m;
  }, [allCompaniesMinimal, companies]);

  // Calculate statistics
  const stats = {
    totalLocations: locations.filter(l => l.type === 'location').length,
    totalSublocations: locations.filter(l => l.type === 'sublocation').length,
    totalDepartments: locations.filter(l => l.type === 'department').length,
    activeLocations: locations.filter(l => l.status === 'active').length,
  };

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
        await deleteLocationAsync(id);
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

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedLocations(filteredLocations.map(l => l.id));
    } else {
      setSelectedLocations([]);
    }
  };

  const handleSelectLocation = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedLocations(prev => [...prev, id]);
    } else {
      setSelectedLocations(prev => prev.filter(locId => locId !== id));
    }
  };

  const handleBulkDelete = async () => {
    if (window.confirm(`Are you sure you want to delete ${selectedLocations.length} location(s)? This action cannot be undone.`)) {
      try {
        await bulkDeleteLocations(selectedLocations);
        setSelectedLocations([]);
        toast({
          title: 'Locations deleted',
          description: `${selectedLocations.length} location(s) have been successfully deleted.`,
        });
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to delete some locations. They may have associated items.',
          variant: 'destructive',
        });
      }
    }
  };

  const handleBulkStatusChange = async (status: string) => {
    try {
      await bulkUpdateStatus(selectedLocations, status);
      setSelectedLocations([]);
      toast({
        title: 'Status updated',
        description: `${selectedLocations.length} location(s) status updated to ${status}.`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update status for some locations.',
        variant: 'destructive',
      });
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

  // Edit location handlers
  const handleOpenEdit = (location: any) => {
    setEditLocationData(location);
    setEditForm({
      name: location.name || '',
      location_code: location.location_code || '',
      type: location.type || 'location',
      parent_id: location.parent_id || '',
      status: location.status || 'active',
      warehouse_category: location.warehouse_category || '',
      capacity: location.capacity ?? '',
      description: location.description || '',
      contact_person: location.contact_person || '',
      contact_phone: location.contact_phone || '',
      physical_address: location.physical_address || '',
      is_standalone_warehouse: !!location.is_standalone_warehouse,
      company_ids: [] as string[], // Will be populated by useEffect
    });
  };
  // Populate company_ids + assignment mode when admin RPC data loads.
  useEffect(() => {
    if (!editLocationData) return;
    const mode = editAssignments.assignmentMode || 'explicit';
    const ids = mode === 'inherit_parent'
      ? editAssignments.effectiveCompanyIds
      : (editLocationCompanyIds.length > 0
          ? editLocationCompanyIds
          : (editLocationData.company_id ? [editLocationData.company_id] : []));
    setEditForm(prev => ({ ...prev, company_ids: ids, assignment_mode: mode }));
  }, [editLocationCompanyIds, editAssignments.assignmentMode, editAssignments.effectiveCompanyIds, editLocationData?.id]);

  const handleEditFormChange = (field: string, value: string | number) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveEdit = async () => {
    if (!editLocationData) return;
    try {
      const isStandalone = !!editForm.is_standalone_warehouse;
      // Standalone warehouses MUST use explicit company assignment.
      const mode = isStandalone
        ? 'explicit'
        : ((editForm.assignment_mode as 'explicit' | 'inherit_parent') || 'explicit');
      await updateLocationAsync({
        id: editLocationData.id,
        name: editForm.name,
        location_code: editForm.location_code || null,
        type: editForm.type,
        parent_id: editForm.parent_id || null,
        status: editForm.status,
        warehouse_category: editForm.warehouse_category || null,
        capacity: editForm.capacity ? Number(editForm.capacity) : null,
        description: editForm.description || null,
        contact_person: editForm.contact_person || null,
        contact_phone: editForm.contact_phone || null,
        physical_address: editForm.physical_address || null,
        company_id: mode === 'explicit' ? (editForm.company_ids?.[0] || null) : null,
        is_standalone_warehouse: isStandalone,
      });
      await saveCompanies({
        locationId: editLocationData.id,
        companyIds: mode === 'explicit' ? (editForm.company_ids || []) : [],
        assignmentMode: mode,
      });
      toast({
        title: 'Location updated',
        description: `${editForm.name} has been successfully updated.`,
      });
      setEditLocationData(null);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to update location.',
        variant: 'destructive',
      });
    }
  };

  // Get potential parent locations based on selected type
  const getParentOptions = () => {
    if (editForm.type === 'sublocation') {
      return locations.filter(l => l.type === 'warehouse' || l.type === 'location');
    }
    if (editForm.type === 'department') {
      return locations.filter(l => l.type === 'warehouse' || l.type === 'location' || l.type === 'sublocation');
    }
    return [];
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
          <TabsTrigger value="bins">Bins</TabsTrigger>
          <TabsTrigger value="hierarchy">Hierarchy</TabsTrigger>
          <TabsTrigger value="capacity">Capacity Planning</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="utilization">Utilization Chart</TabsTrigger>
        </TabsList>

        <TabsContent value="locations" className="space-y-4">
          {/* Bulk Actions Toolbar */}
          {selectedLocations.length > 0 && (
            <div className="bg-blue-50 p-4 rounded-lg flex items-center gap-3">
              <span className="text-sm font-medium">
                {selectedLocations.length} location(s) selected
              </span>
              <Button size="sm" variant="destructive" onClick={handleBulkDelete}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Selected
              </Button>
              <Select onValueChange={handleBulkStatusChange}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Change status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Set Active</SelectItem>
                  <SelectItem value="inactive">Set Inactive</SelectItem>
                  <SelectItem value="maintenance">Set Maintenance</SelectItem>
                  <SelectItem value="closed">Set Closed</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" onClick={() => setSelectedLocations([])}>
                Clear Selection
              </Button>
            </div>
          )}

          {/* Locations Table */}
          <Card>
        <CardHeader>
          <CardTitle>Warehouse Locations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table className="min-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedLocations.length === filteredLocations.length && filteredLocations.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
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
                    <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                      No locations found. Click "Manage Locations" to add one.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLocations.map((location) => (
                    <TableRow key={location.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedLocations.includes(location.id)}
                          onCheckedChange={(checked) => handleSelectLocation(location.id, checked as boolean)}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {location.location_code || '-'}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium flex items-center gap-2 flex-wrap">
                            <span>{location.name}</span>
                            {location.is_standalone_warehouse && (
                              <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                                Standalone
                              </Badge>
                            )}
                          </div>
                          {location.description && (
                            <div className="text-sm text-muted-foreground">
                              {location.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(() => {
                            // Use server-resolved effective companies (handles inheritance chain).
                            const effective = allEffectiveMap[location.id] || [];
                            if (effective.length > 0) {
                              return effective.map((row) => {
                                const comp = companyLookup.get(row.company_id);
                                const label = comp?.code || comp?.name || `#${row.company_id.slice(0, 8)}`;
                                if (row.is_inherited) {
                                  const sourceName = locations.find(l => l.id === row.source_location_id)?.name || 'parent';
                                  return (
                                    <Badge
                                      key={row.company_id}
                                      variant="secondary"
                                      className="text-xs opacity-80"
                                      title={`Inherited from: ${sourceName}`}
                                    >
                                      {label} <span className="ml-1 text-[10px] italic">via {sourceName}</span>
                                    </Badge>
                                  );
                                }
                                return (
                                  <Badge
                                    key={row.company_id}
                                    variant="outline"
                                    className="text-xs"
                                    title={comp?.name || `Unknown company (${row.company_id})`}
                                  >
                                    {label}
                                  </Badge>
                                );
                              });
                            }
                            // Legacy fallback for any rows the RPC hasn't covered yet.
                            const legacy = allLocationCompanyMap[location.id]
                              || (location.company_id ? [location.company_id] : []);
                            if (legacy.length > 0) {
                              return legacy.map((cid: string) => {
                                const comp = companyLookup.get(cid);
                                const label = comp?.code || comp?.name || `#${cid.slice(0, 8)}`;
                                return (
                                  <Badge key={cid} variant="outline" className="text-xs"
                                    title={comp?.name || `Unknown company (${cid})`}>
                                    {label}
                                  </Badge>
                                );
                              });
                            }
                            return <span className="text-muted-foreground">-</span>;
                          })()}
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
                            onClick={() => setDetailsLocationId(location.id)}
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenEdit(location)}
                            title="Edit Location"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
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

        <TabsContent value="bins">
          <BinMasterTab />
        </TabsContent>

        <TabsContent value="hierarchy">
          <LocationHierarchyTab locations={locations} />
        </TabsContent>

        <TabsContent value="capacity">
          <CapacityPlanningTab locations={locations} />
        </TabsContent>

        <TabsContent value="analytics">
          <LocationAnalytics />
        </TabsContent>

        <TabsContent value="utilization">
          <LocationUtilizationChart />
        </TabsContent>
      </Tabs>

      {/* Location Details Dialog */}
      <LocationDetailsDialog
        locationId={detailsLocationId}
        open={detailsLocationId !== null}
        onOpenChange={(open) => !open && setDetailsLocationId(null)}
      />

      {/* Edit Location Dialog */}
      <Dialog open={editLocationData !== null} onOpenChange={(open) => !open && setEditLocationData(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit Location</DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 pr-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
              {editLocationData?.parent_id && (
                <div className="space-y-2 md:col-span-2 flex items-start justify-between gap-3 p-3 rounded-lg border bg-muted/30">
                  <div className="space-y-1">
                    <Label htmlFor="edit-standalone-toggle" className="font-medium">Standalone Warehouse</Label>
                    <p className="text-xs text-muted-foreground">
                      This {editForm.type || 'sub-location'} operates as its own warehouse. Companies and inventory are managed independently from its parent.
                    </p>
                  </div>
                  <Switch
                    id="edit-standalone-toggle"
                    checked={!!editForm.is_standalone_warehouse}
                    onCheckedChange={(checked) => setEditForm(prev => ({
                      ...prev,
                      is_standalone_warehouse: checked,
                      assignment_mode: checked ? 'explicit' : (prev.assignment_mode || 'explicit'),
                    }))}
                  />
                </div>
              )}

              {editLocationData?.parent_id && !editForm.is_standalone_warehouse && (
                <div className="space-y-2 md:col-span-2">
                  <Label>Company Assignment Mode</Label>
                  <Select
                    value={editForm.assignment_mode || 'explicit'}
                    onValueChange={(v) => setEditForm(prev => ({ ...prev, assignment_mode: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inherit_parent">Inherit parent companies (recommended for sub-locations)</SelectItem>
                      <SelectItem value="explicit">Use explicit companies</SelectItem>
                    </SelectContent>
                  </Select>
                  {editForm.assignment_mode === 'inherit_parent' && editAssignments.inheritanceSourceName && (
                    <p className="text-xs text-muted-foreground">
                      Inheriting from <strong>{editAssignments.inheritanceSourceName}</strong>
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label>Companies {editForm.assignment_mode !== 'inherit_parent' && '*'}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-between font-normal"
                      disabled={editForm.assignment_mode === 'inherit_parent'}
                    >
                      {(editForm.company_ids?.length || 0) > 0
                        ? `${editForm.company_ids.length} company(ies) ${editForm.assignment_mode === 'inherit_parent' ? 'inherited' : 'selected'}`
                        : 'Select companies'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-2 max-h-60 overflow-y-auto">
                    {companies.map((c) => (
                      <div key={c.id} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-accent cursor-pointer"
                        onClick={() => {
                          const ids = (editForm.company_ids || []) as string[];
                          const newIds = ids.includes(c.id)
                            ? ids.filter((id: string) => id !== c.id)
                            : [...ids, c.id];
                          setEditForm(prev => ({ ...prev, company_ids: newIds }));
                        }}>
                        <Checkbox checked={(editForm.company_ids || []).includes(c.id)} />
                        <span className="text-sm">{c.name}</span>
                      </div>
                    ))}
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-name">Name *</Label>
                <Input
                  id="edit-name"
                  value={editForm.name || ''}
                  onChange={(e) => handleEditFormChange('name', e.target.value)}
                  placeholder="Location name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-code">Location Code</Label>
                <Input
                  id="edit-code"
                  value={editForm.location_code || ''}
                  onChange={(e) => handleEditFormChange('location_code', e.target.value)}
                  placeholder="e.g. WH-001"
                />
              </div>

              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={editForm.type || 'location'} onValueChange={(v) => handleEditFormChange('type', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="location">Location</SelectItem>
                    <SelectItem value="sublocation">Sublocation</SelectItem>
                    <SelectItem value="department">Department</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Parent Location</Label>
                <Select value={editForm.parent_id || '__none__'} onValueChange={(v) => handleEditFormChange('parent_id', v === '__none__' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="No parent" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No Parent</SelectItem>
                    {getParentOptions().map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editForm.status || 'active'} onValueChange={(v) => handleEditFormChange('status', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Warehouse Category</Label>
                <Select value={editForm.warehouse_category || '__none__'} onValueChange={(v) => handleEditFormChange('warehouse_category', v === '__none__' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    <SelectItem value="raw_materials">Raw Materials</SelectItem>
                    <SelectItem value="finished_goods">Finished Goods</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="wip">Work in Progress</SelectItem>
                    <SelectItem value="returns">Returns</SelectItem>
                    <SelectItem value="quarantine">Quarantine</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-capacity">Capacity</Label>
                <Input
                  id="edit-capacity"
                  type="number"
                  value={editForm.capacity ?? ''}
                  onChange={(e) => handleEditFormChange('capacity', e.target.value)}
                  placeholder="e.g. 1000"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-contact">Contact Person</Label>
                <Input
                  id="edit-contact"
                  value={editForm.contact_person || ''}
                  onChange={(e) => handleEditFormChange('contact_person', e.target.value)}
                  placeholder="Contact name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-phone">Contact Phone</Label>
                <Input
                  id="edit-phone"
                  value={editForm.contact_phone || ''}
                  onChange={(e) => handleEditFormChange('contact_phone', e.target.value)}
                  placeholder="Phone number"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={editForm.description || ''}
                  onChange={(e) => handleEditFormChange('description', e.target.value)}
                  placeholder="Location description"
                  rows={2}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="edit-address">Physical Address</Label>
                <Textarea
                  id="edit-address"
                  value={editForm.physical_address || ''}
                  onChange={(e) => handleEditFormChange('physical_address', e.target.value)}
                  placeholder="Physical address"
                  rows={2}
                />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditLocationData(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={isUpdating || !editForm.name || !(editForm.company_ids?.length > 0)}>
              {isUpdating ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
