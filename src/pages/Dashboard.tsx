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
  MapPin
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocations } from "@/hooks/construction/useConstructionInventory";

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
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const { data: locations } = useLocations();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Enterprise Dashboard</h1>
        <div className="flex items-center gap-3">
          <Select value={locationFilter} onValueChange={setLocationFilter}>
            <SelectTrigger className="w-[220px]">
              <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="All Locations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              {locations?.map(loc => (
                <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="outline" className="text-sm">
            Last updated: {new Date().toLocaleTimeString()}
          </Badge>
        </div>
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