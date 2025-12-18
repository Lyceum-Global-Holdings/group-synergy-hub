import { useState } from "react";
import { Plus, Search, MapPin, Building, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { useProjects } from "@/hooks/construction/useProjects";
import { PROJECT_STATUSES } from "@/types/construction";

export default function SiteManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const { data: projects, isLoading } = useProjects();

  // Filter projects that have location data (sites)
  const sitesWithLocation = projects?.filter(
    (p) => p.address || p.latitude || p.longitude
  );

  const filteredSites = sitesWithLocation?.filter((project) =>
    project.project_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.city?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const statusConfig = PROJECT_STATUSES.find((s) => s.value === status);
    return (
      <Badge className={statusConfig?.color || "bg-muted"}>
        {statusConfig?.label || status}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Site Management</h1>
          <p className="text-muted-foreground">
            Manage construction sites and their locations
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Site
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sites</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sitesWithLocation?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Sites</CardTitle>
            <Building className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {sitesWithLocation?.filter((s) => s.status === "active").length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">With Coordinates</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {sitesWithLocation?.filter((s) => s.latitude && s.longitude).length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search sites..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Coordinates</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSites?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No sites found. Add location data to projects to see them here.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSites?.map((site) => (
                    <TableRow key={site.id}>
                      <TableCell className="font-medium">{site.project_name}</TableCell>
                      <TableCell>{site.address || "-"}</TableCell>
                      <TableCell>{site.city || "-"}</TableCell>
                      <TableCell>{site.state || "-"}</TableCell>
                      <TableCell>{site.country || "-"}</TableCell>
                      <TableCell>{getStatusBadge(site.status)}</TableCell>
                      <TableCell>
                        {site.latitude && site.longitude ? (
                          <span className="text-sm text-muted-foreground">
                            {site.latitude.toFixed(4)}, {site.longitude.toFixed(4)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
