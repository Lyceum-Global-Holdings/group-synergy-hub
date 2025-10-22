import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useDashboards } from "@/hooks/useDashboards";
import { useDashboardWidgets, useDashboardWidgetMutations } from "@/hooks/useDashboardWidgets";
import { WidgetType, DashboardWidget } from "@/types/dashboard";
import { toast } from "@/hooks/use-toast";
import {
  BarChart3,
  LineChart,
  PieChart,
  Gauge,
  AreaChart,
  Table,
  CreditCard,
} from "lucide-react";

const WIDGET_TYPE_OPTIONS: { value: WidgetType; label: string; icon: any }[] = [
  { value: "kpi_card", label: "KPI Card", icon: CreditCard },
  { value: "line_chart", label: "Line Chart", icon: LineChart },
  { value: "bar_chart", label: "Bar Chart", icon: BarChart3 },
  { value: "pie_chart", label: "Pie Chart", icon: PieChart },
  { value: "gauge", label: "Gauge", icon: Gauge },
  { value: "area_chart", label: "Area Chart", icon: AreaChart },
  { value: "table", label: "Table", icon: Table },
];

const DEFAULT_WIDGET_CONFIGS: Record<WidgetType, { width: number; height: number }> = {
  kpi_card: { width: 1, height: 1 },
  line_chart: { width: 2, height: 2 },
  bar_chart: { width: 2, height: 2 },
  pie_chart: { width: 1, height: 2 },
  gauge: { width: 1, height: 1 },
  area_chart: { width: 2, height: 2 },
  table: { width: 3, height: 2 },
};

interface AddToDashboardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kpiId: string;
  kpiName: string;
}

export function AddToDashboardDialog({
  open,
  onOpenChange,
  kpiId,
  kpiName,
}: AddToDashboardDialogProps) {
  const navigate = useNavigate();
  const [selectedDashboard, setSelectedDashboard] = useState<string>("");
  const [widgetType, setWidgetType] = useState<WidgetType>("kpi_card");
  const [widgetTitle, setWidgetTitle] = useState(kpiName);

  const { data: dashboards, isLoading: loadingDashboards } = useDashboards();
  const { data: widgets } = useDashboardWidgets(selectedDashboard || undefined);
  const { createWidget } = useDashboardWidgetMutations();

  const calculateNextPosition = (existingWidgets: DashboardWidget[] | undefined) => {
    if (!existingWidgets || existingWidgets.length === 0) {
      return { position_x: 0, position_y: 0 };
    }

    const maxY = Math.max(...existingWidgets.map((w) => w.position_y + w.height));
    return { position_x: 0, position_y: maxY };
  };

  const handleAddWidget = () => {
    if (!selectedDashboard) {
      toast({
        title: "Error",
        description: "Please select a dashboard",
        variant: "destructive",
      });
      return;
    }

    const position = calculateNextPosition(widgets);
    const config = DEFAULT_WIDGET_CONFIGS[widgetType];

    createWidget.mutate(
      {
        dashboard_id: selectedDashboard,
        kpi_id: kpiId,
        widget_type: widgetType,
        title: widgetTitle,
        position_x: position.position_x,
        position_y: position.position_y,
        width: config.width,
        height: config.height,
        config: {},
        filter_config: null,
      },
      {
        onSuccess: () => {
          toast({
            title: "Success",
            description: "Widget added to dashboard",
            action: (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/management/dashboards/${selectedDashboard}`)}
              >
                View Dashboard
              </Button>
            ),
          });
          onOpenChange(false);
          // Reset form
          setSelectedDashboard("");
          setWidgetType("kpi_card");
          setWidgetTitle(kpiName);
        },
      }
    );
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      // Reset form when closing
      setSelectedDashboard("");
      setWidgetType("kpi_card");
      setWidgetTitle(kpiName);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add {kpiName} to Dashboard</DialogTitle>
          <DialogDescription>
            Select a dashboard and widget type to add this KPI
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {loadingDashboards ? (
            <div className="text-center py-4 text-muted-foreground">Loading dashboards...</div>
          ) : !dashboards || dashboards.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-muted-foreground mb-4">No dashboards found</p>
              <Button onClick={() => navigate("/management/dashboards")}>
                Create Dashboard First
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="dashboard">Dashboard</Label>
                <Select value={selectedDashboard} onValueChange={setSelectedDashboard}>
                  <SelectTrigger id="dashboard">
                    <SelectValue placeholder="Select a dashboard" />
                  </SelectTrigger>
                  <SelectContent>
                    {dashboards.map((dashboard) => (
                      <SelectItem key={dashboard.id} value={dashboard.id}>
                        {dashboard.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Widget Title</Label>
                <Input
                  id="title"
                  value={widgetTitle}
                  onChange={(e) => setWidgetTitle(e.target.value)}
                  placeholder="Enter widget title"
                />
              </div>

              <div className="space-y-2">
                <Label>Widget Type</Label>
                <RadioGroup value={widgetType} onValueChange={(value) => setWidgetType(value as WidgetType)}>
                  <div className="grid grid-cols-2 gap-3">
                    {WIDGET_TYPE_OPTIONS.map((option) => {
                      const Icon = option.icon;
                      return (
                        <div key={option.value} className="relative">
                          <RadioGroupItem
                            value={option.value}
                            id={option.value}
                            className="peer sr-only"
                          />
                          <Label
                            htmlFor={option.value}
                            className="flex items-center gap-2 rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer"
                          >
                            <Icon className="h-4 w-4" />
                            <span className="text-sm">{option.label}</span>
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                </RadioGroup>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAddWidget}
            disabled={!selectedDashboard || createWidget.isPending || !dashboards || dashboards.length === 0}
          >
            {createWidget.isPending ? "Adding..." : "Add Widget"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
