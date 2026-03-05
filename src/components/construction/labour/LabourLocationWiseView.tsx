import { useState, useMemo } from "react";
import { Search, MapPin, Users, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLabourMaster } from "@/hooks/construction/useLabourMaster";
import { useProjects } from "@/hooks/construction/useProjects";
import { useWarehouseLocations } from "@/hooks/useWarehouseLocations";
import { useCurrentUserLocationPermissions } from "@/hooks/useCurrentUserLocationPermissions";

interface AggregatedLocation {
  locationId: string | null;
  locationName: string;
  locationCode: string | null;
  totalCount: number;
  activeCount: number;
  inactiveCount: number;
  categories: Record<string, number>;
  companies: Record<string, number>;
  projects: Record<string, number>;
  labours: Array<{
    id: string;
    employee_id: string | null;
    name: string;
    category: string | null;
    labour_company: string | null;
    project_id: string | null;
    status: string;
  }>;
}

export function LabourLocationWiseView() {
  const [searchTerm, setSearchTerm] = useState("");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const { data: labourMaster, isLoading } = useLabourMaster();
  const { data: projects = [] } = useProjects();
  const { locations: warehouseLocations = [] } = useWarehouseLocations();
  const { data: permissions } = useCurrentUserLocationPermissions();

  // Filter warehouse locations by user permissions
  const permittedLocations = useMemo(() => {
    if (!permissions) return [];
    if (permissions.viewAllLocations) return warehouseLocations;
    const permittedIds = new Set([
      ...permissions.viewLocationIds,
      ...permissions.editLocationIds,
    ]);
    return warehouseLocations.filter(loc => permittedIds.has(loc.id));
  }, [warehouseLocations, permissions]);

  // Create lookup maps
  const projectMap = new Map(projects.map(p => [p.id, p]));
  const locationMap = new Map(permittedLocations.map(l => [l.id, l]));

  // Group by location_id from warehouse_locations
  const groupedByLocation = labourMaster?.reduce((acc, labour) => {
    const locationId = labour.location_id || "__unassigned__";
    const warehouseLocation = labour.location_id ? locationMap.get(labour.location_id) : null;
    const locationName = warehouseLocation?.name || "Unassigned";
    const locationCode = warehouseLocation?.location_code || null;
    
    if (!acc[locationId]) {
      acc[locationId] = {
        locationId: labour.location_id,
        locationName,
        locationCode,
        totalCount: 0,
        activeCount: 0,
        inactiveCount: 0,
        categories: {},
        companies: {},
        projects: {},
        labours: [],
      };
    }

    acc[locationId].totalCount++;
    if (labour.status === "active") {
      acc[locationId].activeCount++;
    } else {
      acc[locationId].inactiveCount++;
    }

    // Track category distribution
    const category = labour.category || "Uncategorized";
    acc[locationId].categories[category] = (acc[locationId].categories[category] || 0) + 1;

    // Track company distribution
    const company = labour.labour_company || "Unassigned";
    acc[locationId].companies[company] = (acc[locationId].companies[company] || 0) + 1;

    // Track project distribution
    if (labour.project_id) {
      const project = projectMap.get(labour.project_id);
      const projectName = project ? project.project_code : "Unknown";
      acc[locationId].projects[projectName] = (acc[locationId].projects[projectName] || 0) + 1;
    }

    acc[locationId].labours.push({
      id: labour.id,
      employee_id: labour.employee_id,
      name: labour.name,
      category: labour.category,
      labour_company: labour.labour_company,
      project_id: labour.project_id,
      status: labour.status,
    });

    return acc;
  }, {} as Record<string, AggregatedLocation>) || {};

  // Get unique locations (with actual location_id values) and categories for filters
  const uniqueLocations = Object.values(groupedByLocation).map(loc => ({
    id: loc.locationId || "__unassigned__",
    name: loc.locationName,
    code: loc.locationCode,
  }));
  const uniqueCategories = [...new Set(labourMaster?.map(l => l.category).filter(Boolean))];

  // Filter locations
  const filteredLocations = Object.entries(groupedByLocation).filter(([locationId, data]) => {
    const matchesLocation = locationFilter === "all" || locationId === locationFilter;
    const matchesSearch = 
      data.locationName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (data.locationCode?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      data.labours.some(l => 
        l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.employee_id?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    
    return matchesLocation && matchesSearch;
  });

  // Filter labours within each location by category
  const getFilteredLabours = (labours: AggregatedLocation['labours']) => {
    if (categoryFilter === "all") return labours;
    return labours.filter(l => l.category === categoryFilter);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search locations or labour..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <Select value={locationFilter} onValueChange={setLocationFilter}>
          <SelectTrigger className="w-[200px]">
            <MapPin className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Location" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            {uniqueLocations.map((loc) => (
              <SelectItem key={loc.id} value={loc.id}>
                {loc.code ? `${loc.code} - ` : ''}{loc.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {uniqueCategories.map((cat) => (
              <SelectItem key={cat} value={cat!}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary */}
      <div className="flex gap-4 text-sm text-muted-foreground">
        <span>{filteredLocations.length} locations</span>
        <span>•</span>
        <span>{labourMaster?.length || 0} total labour</span>
      </div>

      {/* Location Cards */}
      {filteredLocations.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No locations found
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredLocations.map(([locationId, location]) => {
            const filteredLabours = getFilteredLabours(location.labours);
            
            return (
              <Card key={locationId}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-primary" />
                      <div className="flex items-center gap-2">
                        {location.locationCode && (
                          <Badge variant="outline" className="font-mono">
                            {location.locationCode}
                          </Badge>
                        )}
                        <span>{location.locationName}</span>
                      </div>
                    </CardTitle>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-sm font-medium">{location.totalCount}</p>
                        <p className="text-xs text-muted-foreground">Total Labour</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-green-600">{location.activeCount}</p>
                        <p className="text-xs text-muted-foreground">Active</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-muted-foreground">{location.inactiveCount}</p>
                        <p className="text-xs text-muted-foreground">Inactive</p>
                      </div>
                    </div>
                  </div>

                  {/* Category breakdown badges */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    {Object.entries(location.categories).map(([category, count]) => (
                      <Badge key={category} variant="outline" className="text-xs">
                        {category}: {count}
                      </Badge>
                    ))}
                  </div>
                  {/* Project breakdown badges */}
                  {Object.keys(location.projects).length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="text-xs text-muted-foreground">Projects:</span>
                      {Object.entries(location.projects).map(([project, count]) => (
                        <Badge key={project} variant="default" className="text-xs font-normal">
                          {project}: {count}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardHeader>
                
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee ID</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Company</TableHead>
                          <TableHead>Project</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredLabours.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                              No labour matching filter
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredLabours.map((labour) => {
                            const project = labour.project_id ? projectMap.get(labour.project_id) : null;
                            return (
                              <TableRow key={labour.id}>
                                <TableCell className="font-mono text-sm">
                                  <div className="flex items-center gap-2">
                                    <Users className="h-4 w-4 text-muted-foreground" />
                                    {labour.employee_id || "-"}
                                  </div>
                                </TableCell>
                                <TableCell className="font-medium">{labour.name}</TableCell>
                                <TableCell>
                                  {labour.category ? (
                                    <Badge variant="outline">{labour.category}</Badge>
                                  ) : "-"}
                                </TableCell>
                                <TableCell>
                                  {labour.labour_company ? (
                                    <Badge variant="secondary">{labour.labour_company}</Badge>
                                  ) : "-"}
                                </TableCell>
                                <TableCell>
                                  {project ? (
                                    <Badge variant="default" className="font-normal">{project.project_code}</Badge>
                                  ) : (
                                    <span className="text-muted-foreground text-sm">-</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Badge variant={labour.status === "active" ? "default" : "secondary"}>
                                    {labour.status}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}