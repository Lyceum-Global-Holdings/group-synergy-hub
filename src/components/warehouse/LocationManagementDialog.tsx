import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, Edit2, Building, MapPin, Users } from 'lucide-react';
import { useWarehouseLocations } from '@/hooks/useWarehouseLocations';
import { useIsAdminOrHigher } from '@/hooks/useIsAdminOrHigher';
import { useCompanies } from '@/hooks/useCompanies';

type LocationType = 'location' | 'sublocation' | 'department';

export const LocationManagementDialog = () => {
  const [open, setOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    type: LocationType;
    parent_id: string;
    description: string;
    location_code: string;
    capacity: string;
    contact_person: string;
    contact_phone: string;
    physical_address: string;
    status: 'active' | 'inactive' | 'maintenance' | 'closed';
    warehouse_category: string;
    company_id: string;
  }>({
    name: '',
    type: 'location',
    parent_id: 'none',
    description: '',
    location_code: '',
    capacity: '',
    contact_person: '',
    contact_phone: '',
    physical_address: '',
    status: 'active',
    warehouse_category: 'general',
    company_id: ''
  });

  const { 
    locations, 
    createLocation, 
    updateLocation, 
    deleteLocation,
    isCreating,
    isUpdating,
    isDeleting
  } = useWarehouseLocations();
  const { companies } = useCompanies();
  const { canDelete } = useIsAdminOrHigher();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.company_id) return;

    const locationData = {
      name: formData.name,
      type: formData.type,
      parent_id: formData.parent_id === 'none' ? undefined : formData.parent_id,
      description: formData.description || undefined,
      location_code: formData.location_code || undefined,
      capacity: formData.capacity ? parseFloat(formData.capacity) : undefined,
      contact_person: formData.contact_person || undefined,
      contact_phone: formData.contact_phone || undefined,
      physical_address: formData.physical_address || undefined,
      status: formData.status,
      warehouse_category: formData.warehouse_category as any,
      company_id: formData.company_id
    };

    if (editingLocation) {
      updateLocation({ id: editingLocation, ...locationData });
    } else {
      createLocation(locationData);
    }

    resetForm();
  };

  const resetForm = () => {
    setFormData({ 
      name: '', 
      type: 'location', 
      parent_id: 'none', 
      description: '',
      location_code: '',
      capacity: '',
      contact_person: '',
      contact_phone: '',
      physical_address: '',
      status: 'active',
      warehouse_category: 'general',
      company_id: ''
    });
    setEditingLocation(null);
  };

  const handleEdit = (location: any) => {
    setFormData({
      name: location.name,
      type: location.type,
      parent_id: location.parent_id || 'none',
      description: location.description || '',
      location_code: location.location_code || '',
      capacity: location.capacity ? location.capacity.toString() : '',
      contact_person: location.contact_person || '',
      contact_phone: location.contact_phone || '',
      physical_address: location.physical_address || '',
      status: location.status || 'active',
      warehouse_category: location.warehouse_category || 'general',
      company_id: location.company_id || ''
    });
    setEditingLocation(location.id);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this location?')) {
      deleteLocation(id);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <MapPin className="h-4 w-4 mr-2" />
          Manage Locations
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Location Management</DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Form Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">
              {editingLocation ? 'Edit Location' : 'Add New Location'}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="company">Company *</Label>
                <Select
                  value={formData.company_id}
                  onValueChange={(value) => setFormData({ ...formData, company_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select company" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="name">Location Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter location name"
                  required
                />
              </div>

              <div>
                <Label htmlFor="type">Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: LocationType) => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="location">Location</SelectItem>
                    <SelectItem value="sublocation">Sublocation</SelectItem>
                    <SelectItem value="department">Department</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.type === 'sublocation' && (
                <div>
                  <Label htmlFor="parent_id">Parent Location</Label>
                  <Select
                    value={formData.parent_id}
                    onValueChange={(value) => setFormData({ ...formData, parent_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select parent location" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (Optional)</SelectItem>
                      {locations
                        .filter(loc => loc.type === 'location' && loc.id && loc.id.trim() !== "")
                        .map((location) => (
                        <SelectItem key={location.id} value={location.id}>
                          {location.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {formData.type === 'department' && (
                <div>
                  <Label htmlFor="parent_id">Parent Sublocation</Label>
                  <Select
                    value={formData.parent_id}
                    onValueChange={(value) => setFormData({ ...formData, parent_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select parent sublocation" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (Optional)</SelectItem>
                      {locations
                        .filter(loc => loc.type === 'sublocation' && loc.id && loc.id.trim() !== "")
                        .map((sublocation) => (
                        <SelectItem key={sublocation.id} value={sublocation.id}>
                          {sublocation.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label htmlFor="location_code">Location Code</Label>
                <Input
                  id="location_code"
                  value={formData.location_code}
                  onChange={(e) => setFormData({ ...formData, location_code: e.target.value })}
                  placeholder="e.g., WH-001, BAY-A12"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="capacity">Capacity</Label>
                  <Input
                    id="capacity"
                    type="number"
                    step="0.01"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                    placeholder="Storage capacity"
                  />
                </div>

                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: 'active' | 'inactive' | 'maintenance' | 'closed') => 
                      setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {formData.type === 'location' && (
                <div>
                  <Label htmlFor="warehouse_category">Warehouse Category</Label>
                  <Select
                    value={formData.warehouse_category}
                    onValueChange={(value) => setFormData({ ...formData, warehouse_category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="raw_materials">Raw Materials</SelectItem>
                      <SelectItem value="finished_goods">Finished Goods</SelectItem>
                      <SelectItem value="wip">Work In Progress</SelectItem>
                      <SelectItem value="returns">Returns</SelectItem>
                      <SelectItem value="quarantine">Quarantine</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="contact_person">Contact Person</Label>
                  <Input
                    id="contact_person"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    placeholder="Location manager name"
                  />
                </div>

                <div>
                  <Label htmlFor="contact_phone">Contact Phone</Label>
                  <Input
                    id="contact_phone"
                    value={formData.contact_phone}
                    onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                    placeholder="Phone number"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="physical_address">Physical Address</Label>
                <Textarea
                  id="physical_address"
                  value={formData.physical_address}
                  onChange={(e) => setFormData({ ...formData, physical_address: e.target.value })}
                  placeholder="Enter physical address"
                  rows={2}
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Enter location description"
                  rows={2}
                />
              </div>

              <div className="flex gap-2">
                <Button 
                  type="submit" 
                  disabled={isCreating || isUpdating}
                  className="flex-1"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {editingLocation ? 'Update Location' : 'Add Location'}
                </Button>
                {editingLocation && (
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </div>

          {/* Locations List */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Location Hierarchy</h3>
            
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {locations.filter(loc => loc.type === 'location').map((location) => (
                <div key={location.id} className="space-y-2">
                  {/* Main Location */}
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-blue-600" />
                      <div>
                        <div className="font-medium">{location.name}</div>
                        {location.description && (
                          <div className="text-sm text-muted-foreground">
                            {location.description}
                          </div>
                        )}
                      </div>
                      <Badge variant="outline" className="bg-blue-100 text-blue-800">
                        Location
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(location)}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      {canDelete && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(location.id)}
                          disabled={isDeleting}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Sublocations */}
                  {locations
                    .filter(sub => sub.type === 'sublocation' && sub.parent_id === location.id)
                    .map((sublocation) => (
                    <div key={sublocation.id} className="ml-6 space-y-2">
                      <div className="flex items-center justify-between p-2 bg-green-50 rounded">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-green-600" />
                          <div>
                            <div className="font-medium">{sublocation.name}</div>
                            {sublocation.description && (
                              <div className="text-sm text-muted-foreground">
                                {sublocation.description}
                              </div>
                            )}
                          </div>
                          <Badge variant="outline" className="bg-green-100 text-green-800">
                            Sublocation
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(sublocation)}
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          {canDelete && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(sublocation.id)}
                              disabled={isDeleting}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Departments */}
                      {locations
                        .filter(dept => dept.type === 'department' && dept.parent_id === sublocation.id)
                        .map((department) => (
                        <div key={department.id} className="ml-6">
                          <div className="flex items-center justify-between p-2 bg-orange-50 rounded">
                            <div className="flex items-center gap-2">
                              <Users className="h-3 w-3 text-orange-600" />
                              <div>
                                <div className="text-sm font-medium">{department.name}</div>
                                {department.description && (
                                  <div className="text-xs text-muted-foreground">
                                    {department.description}
                                  </div>
                                )}
                              </div>
                              <Badge variant="outline" className="bg-orange-100 text-orange-800">
                                Department
                              </Badge>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEdit(department)}
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                              {canDelete && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDelete(department.id)}
                                  disabled={isDeleting}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};