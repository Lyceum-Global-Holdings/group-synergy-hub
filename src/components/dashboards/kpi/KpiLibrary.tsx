import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useKpiDefinitions } from "@/hooks/useKpiDefinitions";
import { KpiCategory } from "@/types/kpi";
import { Search, Plus, TrendingUp, Package, DollarSign, Users } from "lucide-react";

const categoryIcons: Record<KpiCategory, any> = {
  procurement: Package,
  warehouse: Package,
  finance: DollarSign,
  sourcing: Users,
  custom: TrendingUp,
};

export function KpiLibrary() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<KpiCategory | "all">("all");
  
  const { data: kpis, isLoading } = useKpiDefinitions(
    selectedCategory === "all" ? undefined : selectedCategory
  );

  const filteredKpis = kpis?.filter((kpi) =>
    kpi.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    kpi.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search KPIs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-1" />
          Create Custom KPI
        </Button>
      </div>

      <Tabs value={selectedCategory} onValueChange={(value) => setSelectedCategory(value as KpiCategory | "all")}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="procurement">Procurement</TabsTrigger>
          <TabsTrigger value="warehouse">Warehouse</TabsTrigger>
          <TabsTrigger value="finance">Finance</TabsTrigger>
          <TabsTrigger value="sourcing">Sourcing</TabsTrigger>
          <TabsTrigger value="custom">Custom</TabsTrigger>
        </TabsList>

        <TabsContent value={selectedCategory} className="space-y-4 mt-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading KPIs...</div>
          ) : filteredKpis && filteredKpis.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredKpis.map((kpi) => {
                const Icon = categoryIcons[kpi.category];
                return (
                  <Card key={kpi.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className="h-5 w-5 text-primary" />
                          <CardTitle className="text-base">{kpi.name}</CardTitle>
                        </div>
                        {kpi.is_system && (
                          <Badge variant="secondary">System</Badge>
                        )}
                      </div>
                      {kpi.description && (
                        <CardDescription>{kpi.description}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Unit: {kpi.unit}</span>
                        <Button size="sm" variant="outline">
                          <Plus className="h-3 w-3 mr-1" />
                          Add to Dashboard
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No KPIs found matching your criteria
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
