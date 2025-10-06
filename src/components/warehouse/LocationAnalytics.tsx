import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Activity,
  Package,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { useWarehouseLocations } from '@/hooks/useWarehouseLocations';

export function LocationAnalytics() {
  const { locations } = useWarehouseLocations();

  // Calculate analytics
  const totalLocations = locations.length;
  const activeLocations = locations.filter(l => l.status === 'active').length;
  const maintenanceLocations = locations.filter(l => l.status === 'maintenance').length;
  
  const locationsWithCapacity = locations.filter(l => l.capacity && l.capacity > 0);
  const totalCapacity = locationsWithCapacity.reduce((sum, l) => sum + (l.capacity || 0), 0);
  const totalUsage = locationsWithCapacity.reduce((sum, l) => sum + (l.current_usage || 0), 0);
  const overallUtilization = totalCapacity > 0 ? (totalUsage / totalCapacity) * 100 : 0;

  // Find overutilized locations (>90% capacity)
  const overutilizedLocations = locationsWithCapacity.filter(l => {
    const usage = (l.current_usage || 0) / (l.capacity || 1);
    return usage > 0.9;
  });

  // Find underutilized locations (<30% capacity)
  const underutilizedLocations = locationsWithCapacity.filter(l => {
    const usage = (l.current_usage || 0) / (l.capacity || 1);
    return usage < 0.3 && l.status === 'active';
  });

  // Top utilized locations
  const topUtilizedLocations = [...locationsWithCapacity]
    .sort((a, b) => {
      const usageA = (a.current_usage || 0) / (a.capacity || 1);
      const usageB = (b.current_usage || 0) / (b.capacity || 1);
      return usageB - usageA;
    })
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Utilization</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallUtilization.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {totalUsage.toFixed(0)} / {totalCapacity.toFixed(0)} units used
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Locations</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeLocations}</div>
            <p className="text-xs text-muted-foreground">
              {((activeLocations / totalLocations) * 100).toFixed(0)}% of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overutilized</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{overutilizedLocations.length}</div>
            <p className="text-xs text-muted-foreground">Above 90% capacity</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Maintenance</CardTitle>
            <Package className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{maintenanceLocations}</div>
            <p className="text-xs text-muted-foreground">Under maintenance</p>
          </CardContent>
        </Card>
      </div>

      {/* Alerts & Recommendations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Overutilized Locations Alert */}
        {overutilizedLocations.length > 0 && (
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2 text-red-700">
                <AlertTriangle className="h-4 w-4" />
                High Utilization Alert
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                These locations are near or at capacity:
              </p>
              <div className="space-y-2">
                {overutilizedLocations.map((location) => {
                  const usage = ((location.current_usage || 0) / (location.capacity || 1)) * 100;
                  return (
                    <div key={location.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ArrowUpRight className="h-3 w-3 text-red-600" />
                        <span className="text-sm font-medium">{location.name}</span>
                      </div>
                      <Badge variant="destructive">{usage.toFixed(0)}%</Badge>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Consider transferring items to other locations or expanding capacity.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Underutilized Locations */}
        {underutilizedLocations.length > 0 && (
          <Card className="border-blue-200">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2 text-blue-700">
                <TrendingUp className="h-4 w-4" />
                Optimization Opportunity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                These locations are underutilized:
              </p>
              <div className="space-y-2">
                {underutilizedLocations.slice(0, 5).map((location) => {
                  const usage = ((location.current_usage || 0) / (location.capacity || 1)) * 100;
                  return (
                    <div key={location.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ArrowDownRight className="h-3 w-3 text-blue-600" />
                        <span className="text-sm font-medium">{location.name}</span>
                      </div>
                      <Badge variant="secondary">{usage.toFixed(0)}%</Badge>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Consider consolidating inventory to reduce operational costs.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Top Utilized Locations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Top Utilized Locations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {topUtilizedLocations.map((location, index) => {
              const usage = ((location.current_usage || 0) / (location.capacity || 1)) * 100;
              return (
                <div key={location.id} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-muted-foreground w-4">
                        #{index + 1}
                      </span>
                      <span className="text-sm font-medium">{location.name}</span>
                      {location.location_code && (
                        <span className="text-xs text-muted-foreground font-mono">
                          {location.location_code}
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-bold">{usage.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 ml-6">
                    <div
                      className={`h-2 rounded-full ${
                        usage > 90
                          ? 'bg-red-500'
                          : usage > 70
                          ? 'bg-yellow-500'
                          : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(usage, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}