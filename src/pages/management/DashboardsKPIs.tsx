import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, LayoutDashboard } from "lucide-react";
import { useDashboards } from "@/hooks/useDashboards";
import { DashboardCard } from "@/components/dashboards/DashboardCard";
import { CreateDashboardDialog } from "@/components/dashboards/CreateDashboardDialog";
import { KpiLibrary } from "@/components/dashboards/kpi/KpiLibrary";
import { useDashboardMutations } from "@/hooks/useDashboardMutations";
import { useNavigate } from "react-router-dom";

export default function DashboardsKPIs() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const navigate = useNavigate();
  
  const { data: dashboards, isLoading } = useDashboards();
  const { deleteDashboard } = useDashboardMutations();

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboards & KPIs</h1>
          <p className="text-muted-foreground">
            Create and manage custom dashboards with real-time KPIs
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Create Dashboard
        </Button>
      </div>

      <Tabs defaultValue="dashboards" className="space-y-4">
        <TabsList>
          <TabsTrigger value="dashboards">My Dashboards</TabsTrigger>
          <TabsTrigger value="kpi-library">KPI Library</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboards" className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-muted-foreground">Loading dashboards...</div>
            </div>
          ) : dashboards && dashboards.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {dashboards.map((dashboard) => (
                <DashboardCard
                  key={dashboard.id}
                  dashboard={dashboard}
                  onView={() => navigate(`/management/dashboards/${dashboard.id}`)}
                  onEdit={() => navigate(`/management/dashboards/${dashboard.id}/edit`)}
                  onDelete={() => {
                    if (confirm("Are you sure you want to delete this dashboard?")) {
                      deleteDashboard.mutate(dashboard.id);
                    }
                  }}
                  onShare={() => {
                    // TODO: Implement share functionality
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <LayoutDashboard className="h-12 w-12 text-muted-foreground" />
              <div className="text-center">
                <h3 className="text-lg font-semibold">No dashboards yet</h3>
                <p className="text-muted-foreground">
                  Create your first dashboard to start tracking KPIs
                </p>
              </div>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Create Your First Dashboard
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="kpi-library">
          <KpiLibrary />
        </TabsContent>
      </Tabs>

      <CreateDashboardDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </div>
  );
}
