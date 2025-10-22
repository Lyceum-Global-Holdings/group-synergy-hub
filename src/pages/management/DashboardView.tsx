import { useParams, useNavigate } from "react-router-dom";
import { useDashboard } from "@/hooks/useDashboards";
import { useDashboardWidgets } from "@/hooks/useDashboardWidgets";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit, Share2, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiCard } from "@/components/dashboards/widgets/KpiCard";
import { ChartWidget } from "@/components/dashboards/widgets/ChartWidget";
import { GaugeWidget } from "@/components/dashboards/widgets/GaugeWidget";
import { useDashboardMutations } from "@/hooks/useDashboardMutations";
import { formatDistanceToNow } from "date-fns";
import { DashboardWidget } from "@/types/dashboard";

export default function DashboardView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: dashboard, isLoading: isDashboardLoading } = useDashboard(id);
  const { data: widgets, isLoading: isWidgetsLoading } = useDashboardWidgets(id);
  const { deleteDashboard } = useDashboardMutations();

  const handleEdit = () => {
    navigate(`/management/dashboards/${id}/edit`);
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this dashboard?")) {
      deleteDashboard.mutate(id!, {
        onSuccess: () => navigate("/management/dashboards"),
      });
    }
  };

  const handleShare = () => {
    // TODO: Implement sharing functionality
    alert("Share functionality coming soon!");
  };

  const renderWidget = (widget: DashboardWidget) => {
    switch (widget.widget_type) {
      case "kpi_card":
        return widget.kpi_id ? (
          <KpiCard key={widget.id} kpiId={widget.kpi_id} title={widget.title} />
        ) : (
          <Card key={widget.id}>
            <CardHeader>
              <CardTitle>{widget.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">No KPI associated with this widget</p>
            </CardContent>
          </Card>
        );
      case "line_chart":
      case "bar_chart":
      case "area_chart":
      case "pie_chart":
        return (
          <Card key={widget.id}>
            <CardHeader>
              <CardTitle>{widget.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartWidget
                title=""
                chartType={widget.widget_type}
                data={[
                  { name: "Jan", value: 400 },
                  { name: "Feb", value: 300 },
                  { name: "Mar", value: 600 },
                  { name: "Apr", value: 800 },
                  { name: "May", value: 500 },
                ]}
              />
            </CardContent>
          </Card>
        );
      case "gauge":
        return (
          <Card key={widget.id}>
            <CardHeader>
              <CardTitle>{widget.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <GaugeWidget
                title=""
                value={75}
                maxValue={100}
                unit="%"
                thresholds={{ warning: 70, danger: 90 }}
              />
            </CardContent>
          </Card>
        );
      default:
        return (
          <Card key={widget.id}>
            <CardHeader>
              <CardTitle>{widget.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Widget type "{widget.widget_type}" not yet implemented
              </p>
            </CardContent>
          </Card>
        );
    }
  };

  if (isDashboardLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <h2 className="text-2xl font-semibold mb-2">Dashboard Not Found</h2>
            <p className="text-muted-foreground mb-6">
              The dashboard you're looking for doesn't exist or you don't have access to it.
            </p>
            <Button onClick={() => navigate("/management/dashboards")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboards
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getVisibilityBadge = () => {
    switch (dashboard.visibility) {
      case "company_wide":
        return <Badge variant="secondary">Company Wide</Badge>;
      case "role_based":
        return <Badge variant="outline">Role Based</Badge>;
      case "private":
        return <Badge>Private</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate("/management/dashboards")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-3xl font-bold">{dashboard.name}</h1>
            {dashboard.is_default && (
              <Badge variant="outline">Default</Badge>
            )}
            {getVisibilityBadge()}
          </div>
          {dashboard.description && (
            <p className="text-muted-foreground ml-12">{dashboard.description}</p>
          )}
          <p className="text-sm text-muted-foreground ml-12">
            Created {formatDistanceToNow(new Date(dashboard.created_at), { addSuffix: true })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleShare}>
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
          <Button variant="outline" onClick={handleEdit}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button variant="ghost" onClick={handleDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Widgets Grid */}
      {isWidgetsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      ) : widgets && widgets.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {widgets.map(renderWidget)}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">No widgets in this dashboard yet</p>
            <Button onClick={handleEdit}>
              <Edit className="h-4 w-4 mr-2" />
              Add Widgets
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
