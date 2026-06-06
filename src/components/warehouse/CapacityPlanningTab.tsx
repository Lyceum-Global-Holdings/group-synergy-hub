import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { WarehouseLocation } from '@/types/warehouse';
import { CapacityHeatmapCell } from './CapacityHeatmapCell';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, TrendingUp, CheckCircle } from 'lucide-react';

interface CapacityPlanningTabProps {
  locations: WarehouseLocation[];
}

export function CapacityPlanningTab({ locations }: CapacityPlanningTabProps) {
  // Filter only main locations with capacity
  const locationsWithCapacity = locations.filter(l => l.type === 'warehouse' && l.capacity);

  // Calculate recommendations
  const getRecommendations = () => {
    const recommendations = [];

    // High utilization locations
    const highUtilization = locationsWithCapacity.filter(l => {
      const util = (l.current_usage || 0) / (l.capacity || 1);
      return util >= 0.9;
    });

    if (highUtilization.length > 0) {
      recommendations.push({
        type: 'warning',
        title: 'High Capacity Locations',
        description: `${highUtilization.length} location(s) are at or above 90% capacity`,
        action: 'Consider relocating items or expanding capacity',
        locations: highUtilization.map(l => l.name),
      });
    }

    // Low utilization locations
    const lowUtilization = locationsWithCapacity.filter(l => {
      const util = (l.current_usage || 0) / (l.capacity || 1);
      return util < 0.3 && l.status === 'active';
    });

    if (lowUtilization.length > 0) {
      recommendations.push({
        type: 'info',
        title: 'Underutilized Locations',
        description: `${lowUtilization.length} location(s) are below 30% capacity`,
        action: 'Consolidate inventory to optimize space usage',
        locations: lowUtilization.map(l => l.name),
      });
    }

    // Balanced locations
    const balanced = locationsWithCapacity.filter(l => {
      const util = (l.current_usage || 0) / (l.capacity || 1);
      return util >= 0.5 && util < 0.8;
    });

    if (balanced.length > 0) {
      recommendations.push({
        type: 'success',
        title: 'Well-Balanced Locations',
        description: `${balanced.length} location(s) have optimal capacity utilization (50-80%)`,
        action: 'Maintain current inventory levels',
        locations: balanced.map(l => l.name),
      });
    }

    return recommendations;
  };

  const recommendations = getRecommendations();

  // Calculate overall statistics
  const totalCapacity = locationsWithCapacity.reduce((sum, l) => sum + (l.capacity || 0), 0);
  const totalUsage = locationsWithCapacity.reduce((sum, l) => sum + (l.current_usage || 0), 0);
  const overallUtilization = totalCapacity > 0 ? (totalUsage / totalCapacity * 100).toFixed(1) : '0';

  const avgUtilization = locationsWithCapacity.length > 0
    ? (locationsWithCapacity.reduce((sum, l) => {
        const util = l.capacity ? (l.current_usage || 0) / l.capacity : 0;
        return sum + util;
      }, 0) / locationsWithCapacity.length * 100).toFixed(1)
    : '0';

  return (
    <div className="space-y-6">
      {/* Overall Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Capacity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCapacity.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              units across all locations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Overall Utilization</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallUtilization}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalUsage.toLocaleString()} units in use
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Average Utilization</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgUtilization}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              across {locationsWithCapacity.length} locations
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Capacity Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle>Capacity Heatmap</CardTitle>
          <CardDescription>
            Visual representation of capacity utilization across all locations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {locationsWithCapacity.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No locations with capacity defined. Add capacity to locations to see the heatmap.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
                {locationsWithCapacity.map(location => (
                  <CapacityHeatmapCell
                    key={location.id}
                    location={location}
                  />
                ))}
              </div>
              
              {/* Legend */}
              <div className="flex items-center gap-4 pt-4 border-t">
                <div className="text-sm font-medium">Utilization:</div>
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 bg-blue-500 rounded"></div>
                  <span className="text-xs">0-50%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 bg-green-500 rounded"></div>
                  <span className="text-xs">50-70%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 bg-yellow-500 rounded"></div>
                  <span className="text-xs">70-90%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 bg-red-500 rounded"></div>
                  <span className="text-xs">90-100%</span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle>Capacity Recommendations</CardTitle>
          <CardDescription>
            AI-powered insights to optimize your warehouse space
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recommendations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No recommendations available at this time
            </div>
          ) : (
            <div className="space-y-4">
              {recommendations.map((rec, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-lg border-l-4 ${
                    rec.type === 'warning' ? 'bg-yellow-50 border-yellow-500' :
                    rec.type === 'success' ? 'bg-green-50 border-green-500' :
                    'bg-blue-50 border-blue-500'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {rec.type === 'warning' && <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />}
                    {rec.type === 'success' && <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />}
                    {rec.type === 'info' && <TrendingUp className="h-5 w-5 text-blue-600 mt-0.5" />}
                    
                    <div className="flex-1">
                      <div className="font-semibold">{rec.title}</div>
                      <div className="text-sm mt-1">{rec.description}</div>
                      <div className="text-sm font-medium mt-2">{rec.action}</div>
                      
                      {rec.locations.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {rec.locations.slice(0, 5).map((locName, i) => (
                            <Badge key={i} variant="outline">
                              {locName}
                            </Badge>
                          ))}
                          {rec.locations.length > 5 && (
                            <Badge variant="outline">
                              +{rec.locations.length - 5} more
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
