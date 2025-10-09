import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, Building, MapPin, Users, Eye, Edit2 } from 'lucide-react';
import { WarehouseLocation } from '@/types/warehouse';

interface LocationHierarchyTabProps {
  locations: WarehouseLocation[];
}

interface LocationNode extends WarehouseLocation {
  children: LocationNode[];
}

export function LocationHierarchyTab({ locations }: LocationHierarchyTabProps) {
  const buildLocationTree = (): LocationNode[] => {
    const locationMap = new Map<string, LocationNode>();
    
    // Initialize all locations as nodes
    locations.forEach(loc => {
      locationMap.set(loc.id, { ...loc, children: [] });
    });

    const rootNodes: LocationNode[] = [];

    // Build the tree structure
    locations.forEach(loc => {
      const node = locationMap.get(loc.id)!;
      
      if (loc.type === 'location') {
        rootNodes.push(node);
      } else if (loc.parent_id) {
        const parent = locationMap.get(loc.parent_id);
        if (parent) {
          parent.children.push(node);
        } else {
          // If parent not found, add as root node
          rootNodes.push(node);
        }
      }
    });

    return rootNodes;
  };

  const locationTree = buildLocationTree();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Location Hierarchy</CardTitle>
        <CardDescription>
          Visual representation of your warehouse structure with capacity utilization
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {locationTree.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No locations found. Create locations to see the hierarchy.
            </div>
          ) : (
            locationTree.map(location => (
              <LocationTreeNode
                key={location.id}
                location={location}
                level={0}
              />
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface LocationTreeNodeProps {
  location: LocationNode;
  level: number;
}

function LocationTreeNode({ location, level }: LocationTreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const utilization = location.capacity 
    ? ((location.current_usage || 0) / location.capacity * 100)
    : 0;

  const getUtilizationColor = () => {
    if (utilization >= 90) return 'bg-red-500 text-white';
    if (utilization >= 70) return 'bg-yellow-500 text-white';
    if (utilization >= 50) return 'bg-green-500 text-white';
    return 'bg-blue-500 text-white';
  };

  const getTypeIcon = () => {
    switch (location.type) {
      case 'location': return Building;
      case 'sublocation': return MapPin;
      case 'department': return Users;
      default: return Building;
    }
  };

  const Icon = getTypeIcon();

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'active': return 'border-green-500 bg-green-50';
      case 'inactive': return 'border-gray-400 bg-gray-50';
      case 'maintenance': return 'border-yellow-500 bg-yellow-50';
      case 'closed': return 'border-red-500 bg-red-50';
      default: return 'border-gray-300 bg-white';
    }
  };

  return (
    <div className="space-y-1">
      {/* Parent node */}
      <div 
        className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-colors hover:bg-gray-50 ${getStatusColor(location.status)}`}
        style={{ marginLeft: `${level * 32}px` }}
      >
        {location.children?.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-6 w-6 p-0"
          >
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        )}
        
        {(!location.children || location.children.length === 0) && (
          <div className="w-6" />
        )}

        <Icon className="h-4 w-4 text-muted-foreground" />

        {location.capacity && (
          <Badge className={getUtilizationColor()}>
            {utilization.toFixed(0)}%
          </Badge>
        )}
        
        <span className="font-medium">{location.name}</span>
        
        {location.location_code && (
          <span className="text-sm text-muted-foreground font-mono">
            ({location.location_code})
          </span>
        )}

        <Badge variant="outline" className="ml-2">
          {location.type}
        </Badge>

        {location.capacity && (
          <span className="text-sm text-muted-foreground ml-auto">
            {location.current_usage || 0} / {location.capacity} units
          </span>
        )}
      </div>
      
      {/* Children nodes */}
      {isExpanded && location.children?.map(child => (
        <LocationTreeNode
          key={child.id}
          location={child}
          level={level + 1}
        />
      ))}
    </div>
  );
}
