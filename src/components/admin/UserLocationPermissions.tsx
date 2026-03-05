import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { MapPin, Eye, Pencil } from 'lucide-react';

interface Location {
  id: string;
  name: string;
}

interface UserLocationPermissionsProps {
  availableLocations: Location[];
  viewLocationIds: string[];
  editLocationIds: string[];
  viewAllLocations: boolean;
  onViewLocationsChange: (ids: string[]) => void;
  onEditLocationsChange: (ids: string[]) => void;
  onViewAllLocationsChange: (value: boolean) => void;
  isLoading?: boolean;
}

export const UserLocationPermissions: React.FC<UserLocationPermissionsProps> = ({
  availableLocations,
  viewLocationIds,
  editLocationIds,
  viewAllLocations,
  onViewLocationsChange,
  onEditLocationsChange,
  onViewAllLocationsChange,
  isLoading,
}) => {
  const toggleView = (locationId: string, checked: boolean) => {
    if (checked) {
      onViewLocationsChange([...viewLocationIds, locationId]);
    } else {
      onViewLocationsChange(viewLocationIds.filter(id => id !== locationId));
      // Also remove from edit if unchecking view
      onEditLocationsChange(editLocationIds.filter(id => id !== locationId));
    }
  };

  const toggleEdit = (locationId: string, checked: boolean) => {
    if (checked) {
      onEditLocationsChange([...editLocationIds, locationId]);
      // Auto-grant view if granting edit
      if (!viewLocationIds.includes(locationId) && !viewAllLocations) {
        onViewLocationsChange([...viewLocationIds, locationId]);
      }
    } else {
      onEditLocationsChange(editLocationIds.filter(id => id !== locationId));
    }
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground py-4">Loading locations...</div>;
  }

  if (availableLocations.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4 border rounded-md p-4">
        <MapPin className="h-4 w-4 inline mr-1" />
        No locations available for the assigned companies.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* View All Locations Toggle */}
      <div className="flex items-center justify-between p-3 border rounded-md bg-muted/30">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-muted-foreground" />
          <Label htmlFor="view-all-locations" className="text-sm font-medium cursor-pointer">
            View All Locations
          </Label>
        </div>
        <Switch
          id="view-all-locations"
          checked={viewAllLocations}
          onCheckedChange={onViewAllLocationsChange}
        />
      </div>

      {/* Location Grid */}
      <div className="border rounded-md overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1fr_80px_80px] gap-2 px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
          <span>Location</span>
          <span className="text-center flex items-center justify-center gap-1">
            <Eye className="h-3 w-3" /> View
          </span>
          <span className="text-center flex items-center justify-center gap-1">
            <Pencil className="h-3 w-3" /> Edit
          </span>
        </div>

        {/* Rows */}
        <div className="max-h-[200px] overflow-y-auto divide-y">
          {availableLocations.map((location) => (
            <div
              key={location.id}
              className="grid grid-cols-[1fr_80px_80px] gap-2 px-4 py-2.5 items-center hover:bg-muted/20 transition-colors"
            >
              <span className="text-sm flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                {location.name}
              </span>
              <div className="flex justify-center">
                <Checkbox
                  checked={viewAllLocations || viewLocationIds.includes(location.id)}
                  disabled={viewAllLocations}
                  onCheckedChange={(checked) => toggleView(location.id, !!checked)}
                />
              </div>
              <div className="flex justify-center">
                <Checkbox
                  checked={editLocationIds.includes(location.id)}
                  onCheckedChange={(checked) => toggleEdit(location.id, !!checked)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Users can view data from selected locations. Edit permissions restrict data modification to only the assigned locations.
      </p>
    </div>
  );
};
