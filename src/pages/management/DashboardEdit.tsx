import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useDashboard } from "@/hooks/useDashboards";
import { useDashboardWidgets, useDashboardWidgetMutations } from "@/hooks/useDashboardWidgets";
import { useDashboardMutations } from "@/hooks/useDashboardMutations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Plus, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { DashboardVisibility } from "@/types/dashboard";

export default function DashboardEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: dashboard, isLoading: isDashboardLoading } = useDashboard(id);
  const { data: widgets, isLoading: isWidgetsLoading } = useDashboardWidgets(id);
  const { updateDashboard } = useDashboardMutations();
  const { deleteWidget } = useDashboardWidgetMutations();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<DashboardVisibility>("private");
  const [isDefault, setIsDefault] = useState(false);

  // Initialize form values when dashboard loads
  useState(() => {
    if (dashboard) {
      setName(dashboard.name);
      setDescription(dashboard.description || "");
      setVisibility(dashboard.visibility);
      setIsDefault(dashboard.is_default);
    }
  });

  const handleSave = () => {
    if (!name.trim()) {
      toast.error("Dashboard name is required");
      return;
    }

    updateDashboard.mutate(
      {
        id: id!,
        name,
        description,
        visibility,
        is_default: isDefault,
      },
      {
        onSuccess: () => {
          toast.success("Dashboard updated successfully");
          navigate(`/management/dashboards/${id}`);
        },
      }
    );
  };

  const handleCancel = () => {
    navigate(`/management/dashboards/${id}`);
  };

  const handleDeleteWidget = (widgetId: string) => {
    if (confirm("Are you sure you want to delete this widget?")) {
      deleteWidget.mutate(widgetId);
    }
  };

  const handleAddWidget = () => {
    // TODO: Implement add widget dialog
    toast.info("Add widget functionality coming soon!");
  };

  if (isDashboardLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96 w-full" />
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
              The dashboard you're trying to edit doesn't exist or you don't have permission to edit it.
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

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={handleCancel}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold">Edit Dashboard</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={updateDashboard.isPending}>
            <Save className="h-4 w-4 mr-2" />
            {updateDashboard.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Dashboard Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Dashboard Settings</CardTitle>
          <CardDescription>Update your dashboard name, description, and visibility settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Dashboard Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter dashboard name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter dashboard description"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="visibility">Visibility</Label>
            <Select value={visibility} onValueChange={(value) => setVisibility(value as DashboardVisibility)}>
              <SelectTrigger id="visibility">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="private">Private - Only you can see this</SelectItem>
                <SelectItem value="role_based">Role Based - Specific roles can access</SelectItem>
                <SelectItem value="company_wide">Company Wide - Everyone in your company</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isDefault"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="h-4 w-4"
            />
            <Label htmlFor="isDefault" className="cursor-pointer">
              Set as default dashboard
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Widgets Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Widgets</CardTitle>
              <CardDescription>Manage the widgets displayed on this dashboard</CardDescription>
            </div>
            <Button onClick={handleAddWidget}>
              <Plus className="h-4 w-4 mr-2" />
              Add Widget
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isWidgetsLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
          ) : widgets && widgets.length > 0 ? (
            <div className="space-y-3">
              {widgets.map((widget) => (
                <div
                  key={widget.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/5"
                >
                  <div>
                    <h4 className="font-medium">{widget.title}</h4>
                    <p className="text-sm text-muted-foreground capitalize">
                      {widget.widget_type.replace("_", " ")}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteWidget(widget.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No widgets yet. Click "Add Widget" to get started.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
