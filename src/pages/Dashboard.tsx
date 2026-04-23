import { useState } from "react";
import { 
  Calculator, 
  Package, 
  Users, 
  ShoppingCart, 
  BarChart3, 
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  MapPin,
  HardHat,
  Wrench,
  Boxes,
  Loader2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDashboardLocations } from "@/hooks/useWarehouseLocations";
import { useDashboardLocationData } from "@/hooks/useDashboardLocationData";
import { useLocationFilter } from "@/contexts/LocationFilterContext";
import { useCompany } from "@/contexts/CompanyContext";

const kpiData = [
  {
    title: "Total Purchase Orders",
    value: "1,247",
    change: "+12.5%",
    trend: "up",
    icon: ShoppingCart,
    color: "text-primary"
  },
  {
    title: "Active Suppliers",
    value: "89",
    change: "+3.2%",
    trend: "up",
    icon: Users,
    color: "text-success"
  },
  {
    title: "Pending Approvals",
    value: "24",
    change: "-15.8%",
    trend: "down",
    icon: Clock,
    color: "text-warning"
  },
  {
    title: "Monthly Spend",
    value: "Rs. 2.4M",
    change: "+8.1%",
    trend: "up",
    icon: DollarSign,
    color: "text-info"
  }
];

const departmentStatus = [
  {
    department: "Finance",
    modules: 10,
    active: 8,
    pending: 2,
    icon: Calculator,
    completion: 80
  },
  {
    department: "Warehouse",
    modules: 10,
    active: 9,
    pending: 1,
    icon: Package,
    completion: 90
  },
  {
    department: "Sourcing",
    modules: 8,
    active: 7,
    pending: 1,
    icon: Users,
    completion: 87.5
  },
  {
    department: "Procurement",
    modules: 7,
    active: 6,
    pending: 1,
    icon: ShoppingCart,
    completion: 85.7
  },
  {
    department: "Management",
    modules: 5,
    active: 5,
    pending: 0,
    icon: BarChart3,
    completion: 100
  }
];

const recentActivities = [
  {
    type: "approval",
    message: "Purchase Order PO-2024-0892 approved",
    time: "2 minutes ago",
    status: "success"
  },
  {
    type: "alert",
    message: "Supplier evaluation overdue for Tech Solutions Ltd",
    time: "15 minutes ago",
    status: "warning"
  },
  {
    type: "info",
    message: "New RFQ created for Office Supplies category",
    time: "1 hour ago",
    status: "info"
  },
  {
    type: "approval",
    message: "Budget allocation approved for Q2 2024",
    time: "2 hours ago",
    status: "success"
  }
];

export default function Dashboard() {
  const { globalLocationId, setGlobalLocationId } = useLocationFilter();
  const { selectedCompany } = useCompany();
  const [locationFilter, setLocationFilter] = useState<string>(globalLocationId || "all");
  const { data: locations, isLoading: locationsLoading, isError: locationsError } = useDashboardLocations(selectedCompany?.id);
  const activeLocationId = locationFilter === "all" ? null : locationFilter;
  const { inventory, labour, isLoading: locationDataLoading } = useDashboardLocationData(activeLocationId);
  const selectedLocationName = locationFilter === "all"
    ? "All Locations"
    : locations?.find((l) => l.id === locationFilter)?.name || "Selected Location";

  // Sync local filter to global context
  const handleLocationChange = (value: string) => {
    setLocationFilter(value);
    setGlobalLocationId(value === "all" ? null : value);
  };

  let locationPlaceholder = "All Locations";
  if (!selectedCompany?.id) locationPlaceholder = "Select a company";
  else if (locationsLoading) locationPlaceholder = "Loading locations…";
  else if (locationsError) locationPlaceholder = "Failed to load locations";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Enterprise Dashboard</h1>
        <Badge variant="outline" className="text-sm">
          Last updated: {new Date().toLocaleTimeString()}
        </Badge>
      </div>

      {/* Location Filter - prominent row */}
      <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
        <MapPin className="h-5 w-5 text-primary" />
        <span className="text-sm font-medium text-muted-foreground">Location:</span>
        <Select
          value={locationFilter}
          onValueChange={handleLocationChange}
          disabled={locationsLoading || !selectedCompany?.id}
        >
          <SelectTrigger className="w-[260px]">
            <SelectValue placeholder={locationPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            {locationsError && (
              <SelectItem value="__error" disabled>
                Failed to load locations
              </SelectItem>
            )}
            {!locationsError && !locationsLoading && (locations?.length ?? 0) === 0 && selectedCompany?.id && (
              <SelectItem value="__empty" disabled>
                No locations mapped to this company
              </SelectItem>
            )}
            {locations && locations.length > 0 && locations.map(loc => (
              <SelectItem key={loc.id} value={loc.id}>
                {loc.parent_id ? `↳ ${loc.name}` : loc.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpiData.map((kpi) => (
          <Card key={kpi.title} className="relative overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {kpi.title}
                </CardTitle>
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">{kpi.value}</div>
                <div className={`flex items-center text-sm ${
                  kpi.trend === 'up' ? 'text-success' : 'text-destructive'
                }`}>
                  <TrendingUp className={`h-4 w-4 mr-1 ${
                    kpi.trend === 'down' ? 'rotate-180' : ''
                  }`} />
                  {kpi.change}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Construction Module - Location Filtered Data */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <HardHat className="h-5 w-5 text-primary" />
          Construction Module — {selectedLocationName}
        </h2>

        {locationDataLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Wrench className="h-4 w-4" />
                  Serial-Tracked Assets
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{inventory?.serialCount ?? 0}</div>
                <p className="text-xs text-muted-foreground mt-1">Machines / Equipment with serials</p>
                {inventory?.conditionBreakdown && Object.keys(inventory.conditionBreakdown).length > 0 && (
                  <div className="mt-3 space-y-1">
                    {Object.entries(inventory.conditionBreakdown).map(([condition, count]) => (
                      <div key={condition} className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{condition}</span>
                        <Badge variant="outline" className="text-xs h-5">{count}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Boxes className="h-4 w-4" />
                  Bulk Stock Items
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{inventory?.bulkItemCount ?? 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Total qty: {inventory?.totalBulkQty ?? 0} units
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Total Labour
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{labour?.totalLabour ?? 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {labour?.activeLabour ?? 0} active
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <HardHat className="h-4 w-4" />
                  Labour by Trade
                </CardTitle>
              </CardHeader>
              <CardContent>
                {labour?.tradeBreakdown && Object.keys(labour.tradeBreakdown).length > 0 ? (
                  <div className="space-y-1">
                    {Object.entries(labour.tradeBreakdown).map(([trade, count]) => (
                      <div key={trade} className="flex justify-between text-xs">
                        <span className="text-muted-foreground truncate mr-2">{trade}</span>
                        <Badge variant="outline" className="text-xs h-5 shrink-0">{count}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No labour data</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Department Module Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {departmentStatus.map((dept) => (
              <div key={dept.department} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <dept.icon className="h-4 w-4 text-primary" />
                    <span className="font-medium">{dept.department}</span>
                  </div>
                  <Badge variant="outline">
                    {dept.active}/{dept.modules} modules
                  </Badge>
                </div>
                <Progress value={dept.completion} className="h-2" />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{dept.completion}% complete</span>
                  {dept.pending > 0 && (
                    <span>{dept.pending} pending</span>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent Activities */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Activities
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentActivities.map((activity, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className={`mt-1 p-1 rounded-full ${
                  activity.status === 'success' ? 'bg-success/20' :
                  activity.status === 'warning' ? 'bg-warning/20' :
                  'bg-info/20'
                }`}>
                  {activity.status === 'success' ? (
                    <CheckCircle className="h-3 w-3 text-success" />
                  ) : activity.status === 'warning' ? (
                    <AlertTriangle className="h-3 w-3 text-warning" />
                  ) : (
                    <BarChart3 className="h-3 w-3 text-info" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {activity.message}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {activity.time}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {[
              { name: "New Purchase Requisition", icon: ShoppingCart, color: "bg-primary" },
              { name: "Supplier Registration", icon: Users, color: "bg-success" },
              { name: "Stock Adjustment", icon: Package, color: "bg-warning" },
              { name: "Budget Allocation", icon: Calculator, color: "bg-info" },
              { name: "Generate Reports", icon: BarChart3, color: "bg-secondary" }
            ].map((action) => (
              <button
                key={action.name}
                className="flex flex-col items-center p-4 rounded-lg border hover:bg-accent transition-colors"
              >
                <div className={`p-3 rounded-full ${action.color} mb-2`}>
                  <action.icon className="h-5 w-5 text-white" />
                </div>
                <span className="text-sm font-medium text-center">{action.name}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}