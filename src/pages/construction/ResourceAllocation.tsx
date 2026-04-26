import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Package, Building, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConstructionResources } from "@/hooks/construction/useConstructionResources";
import { useConstructionSites } from "@/hooks/construction/useConstructionSites";
import { GenerateReportButton } from "@/components/management/reports/GenerateReportButton";

export default function ResourceAllocation() {
  const navigate = useNavigate();
  const { data: resources } = useConstructionResources();
  const { data: sites, isLoading: sitesLoading } = useConstructionSites();
  const [selectedSiteId, setSelectedSiteId] = useState<string>("all");

  // Filter resources by selected site
  const filteredResources = selectedSiteId === "all"
    ? resources
    : resources?.filter((r) => r.assigned_site_id === selectedSiteId);

  const cards = [
    {
      title: "Labour",
      icon: Users,
      count: filteredResources?.filter((r) => r.resource_type === "labor").length || 0,
      path: "/construction/resource-allocation/labour",
      description: "Manage labour resources and allocations",
    },
    {
      title: "Inventory",
      icon: Package,
      count: filteredResources?.filter((r) => r.resource_type === "material").length || 0,
      path: "/construction/resource-allocation/inventory",
      description: "Manage inventory items and materials",
    },
    {
      title: "Subcontractor",
      icon: Building,
      count: filteredResources?.filter((r) => r.resource_type === "subcontractor").length || 0,
      path: "/construction/resource-allocation/subcontractors",
      description: "Manage subcontractor assignments",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Resource Allocation</h1>
          <p className="text-muted-foreground">
            Manage project resources including labour, inventory, and subcontractors
          </p>
        </div>

        <div className="flex items-center gap-3">
          <GenerateReportButton template="CN-MAT-MOV-001" />
          {/* Site Location Filter */}
          <div className="flex items-center gap-2 min-w-[240px]">
          <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
          <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Filter by site..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sites</SelectItem>
              {sites?.map((site) => (
                <SelectItem key={site.id} value={site.id}>
                  {site.site_name} ({site.site_code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <Card
            key={card.title}
            className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50"
            onClick={() => navigate(card.path)}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.count}</div>
              <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
