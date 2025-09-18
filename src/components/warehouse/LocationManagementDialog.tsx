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

type LocationType = 'location' | 'sublocation' | 'department';

export const LocationManagementDialog = () => {
  const [open, setOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    type: LocationType;
    parent_id: string;
    description: string;
  }>({
    name: '',
    type: 'location',
    parent_id: 'none',
    description: ''
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) return;

    const locationData = {
      name: formData.name,
      type: formData.type,
      parent_id: formData.parent_id === 'none' ? undefined : formData.parent_id,
      description: formData.description || undefined
    };

    if (editingLocation) {
      updateLocation({ id: editingLocation, ...locationData });
    } else {
      createLocation(locationData);
    }

    resetForm();
  };

  const resetForm = () => {
    setFormData({ name: '', type: 'location', parent_id: 'none', description: '' });
    setEditingLocation(null);
  };

  const handleEdit = (location: any) => {
    setFormData({
      name: location.name,
      type: location.type,
      parent_id: location.parent_id || 'none',
      description: location.description || ''
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
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
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
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Enter location description"
                  rows={3}
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
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(location.id)}
                        disabled={isDeleting}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
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
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(sublocation.id)}
                            disabled={isDeleting}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
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
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDelete(department.id)}
                                disabled={isDeleting}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
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