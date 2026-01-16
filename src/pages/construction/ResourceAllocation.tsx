import { useNavigate } from "react-router-dom";
import { Users, Package, Building } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useConstructionResources } from "@/hooks/construction/useConstructionResources";

export default function ResourceAllocation() {
  const navigate = useNavigate();
  const { data: resources } = useConstructionResources();

  const cards = [
    {
      title: "Labour",
      icon: Users,
      count: resources?.filter((r) => r.resource_type === "labor").length || 0,
      path: "/construction/resource-allocation/labour",
      description: "Manage labour resources and allocations",
    },
    {
      title: "Inventory",
      icon: Package,
      count: resources?.filter((r) => r.resource_type === "material").length || 0,
      path: "/construction/resource-allocation/inventory",
      description: "Manage inventory items and materials",
    },
    {
      title: "Subcontractor",
      icon: Building,
      count: resources?.filter((r) => r.resource_type === "subcontractor").length || 0,
      path: "/construction/resource-allocation/subcontractors",
      description: "Manage subcontractor assignments",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Resource Allocation</h1>
        <p className="text-muted-foreground">
          Manage project resources including labour, inventory, and subcontractors
        </p>
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
