import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Building2, MapPin, FolderOpen, UserCheck, UserX, Briefcase } from "lucide-react";
import { useLabourDirectory } from "@/hooks/construction/useLabourMaster";
import { useProjects } from "@/hooks/construction/useProjects";

export function LabourDashboard() {
  const { data: labourMaster, isLoading } = useLabourDirectory();
  const { data: projects = [] } = useProjects();

  // Create a project lookup map
  const projectMap = new Map(projects.map(p => [p.id, p]));

  // Calculate dashboard metrics
  const totalLabour = labourMaster?.length || 0;
  const activeLabour = labourMaster?.filter(l => l.status === "active").length || 0;
  const inactiveLabour = labourMaster?.filter(l => l.status !== "active").length || 0;
  const assignedToProject = labourMaster?.filter(l => l.project_id).length || 0;
  const unassignedLabour = labourMaster?.filter(l => !l.project_id).length || 0;

  // Category-wise count
  const categoryCount = labourMaster?.reduce((acc, labour) => {
    const category = labour.category || "Uncategorized";
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  // Company-wise count
  const companyCount = labourMaster?.reduce((acc, labour) => {
    const company = labour.labour_company || "Unassigned";
    acc[company] = (acc[company] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  // Location-wise count (using location_id field with joined location name)
  const locationCount = labourMaster?.reduce((acc, labour) => {
    const labourWithLocation = labour as typeof labour & { location?: { id: string; name: string } | null };
    const locationName = labourWithLocation.location?.name || "Unassigned";
    acc[locationName] = (acc[locationName] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  // Project-wise count
  const projectCount = labourMaster?.reduce((acc, labour) => {
    if (labour.project_id) {
      const project = projectMap.get(labour.project_id);
      const projectName = project ? project.project_code : "Unknown";
      acc[projectName] = (acc[projectName] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>) || {};

  const kpiCards = [
    {
      title: "Total Labour",
      value: totalLabour.toString(),
      icon: Users,
      description: "Registered workers",
      color: "text-blue-500",
    },
    {
      title: "Active Labour",
      value: activeLabour.toString(),
      icon: UserCheck,
      description: "Currently active",
      color: "text-green-500",
    },
    {
      title: "Assigned to Projects",
      value: assignedToProject.toString(),
      icon: Briefcase,
      description: `${unassignedLabour} unassigned`,
      color: "text-purple-500",
    },
    {
      title: "Categories",
      value: Object.keys(categoryCount).length.toString(),
      icon: FolderOpen,
      description: `${Object.values(categoryCount)[0] || 0} in largest category`,
      color: "text-indigo-500",
    },
    {
      title: "Companies",
      value: Object.keys(companyCount).length.toString(),
      icon: Building2,
      description: `${Object.values(companyCount)[0] || 0} in largest company`,
      color: "text-orange-500",
    },
    {
      title: "Locations/Trades",
      value: Object.keys(locationCount).length.toString(),
      icon: MapPin,
      description: "Different assignments",
      color: "text-cyan-500",
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {kpiCards.map((kpi) => (
          <Card key={kpi.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
              <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.value}</div>
              <p className="text-xs text-muted-foreground">{kpi.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Category Breakdown */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-primary" />
              Category-wise Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(categoryCount).length === 0 ? (
                <p className="text-muted-foreground text-sm">No categories found</p>
              ) : (
                Object.entries(categoryCount)
                  .sort((a, b) => b[1] - a[1])
                  .map(([category, count]) => (
                    <div key={category} className="flex items-center justify-between">
                      <span className="text-sm font-medium">{category}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-muted rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full"
                            style={{ width: `${(count / totalLabour) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm text-muted-foreground w-8 text-right">{count}</span>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Company-wise Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(companyCount).length === 0 ? (
                <p className="text-muted-foreground text-sm">No companies found</p>
              ) : (
                Object.entries(companyCount)
                  .sort((a, b) => b[1] - a[1])
                  .map(([company, count]) => (
                    <div key={company} className="flex items-center justify-between">
                      <span className="text-sm font-medium">{company}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-muted rounded-full h-2">
                          <div
                            className="bg-orange-500 h-2 rounded-full"
                            style={{ width: `${(count / totalLabour) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm text-muted-foreground w-8 text-right">{count}</span>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Project-wise and Location/Trade Breakdown */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" />
              Project-wise Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(projectCount).length === 0 ? (
                <p className="text-muted-foreground text-sm">No project assignments found</p>
              ) : (
                Object.entries(projectCount)
                  .sort((a, b) => b[1] - a[1])
                  .map(([project, count]) => (
                    <div key={project} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{project}</span>
                      </div>
                      <span className="text-sm font-bold">{count}</span>
                    </div>
                  ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Trade/Location Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(locationCount).length === 0 ? (
                <p className="text-muted-foreground text-sm">No trades/locations found</p>
              ) : (
                Object.entries(locationCount)
                  .sort((a, b) => b[1] - a[1])
                  .map(([location, count]) => (
                    <div key={location} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{location}</span>
                      </div>
                      <span className="text-sm font-bold">{count}</span>
                    </div>
                  ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
