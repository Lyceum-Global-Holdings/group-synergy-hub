import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useWarehouseLocations } from '@/hooks/useWarehouseLocations';

export function LocationUtilizationChart() {
  const { locations } = useWarehouseLocations();

  // Prepare chart data
  const chartData = locations
    .filter(l => l.capacity && l.capacity > 0)
    .map(location => {
      const usage = location.current_usage || 0;
      const capacity = location.capacity || 1;
      const utilizationPercent = (usage / capacity) * 100;
      
      return {
        name: location.location_code || location.name,
        fullName: location.name,
        used: usage,
        available: capacity - usage,
        utilization: utilizationPercent,
        capacity: capacity,
      };
    })
    .sort((a, b) => b.utilization - a.utilization)
    .slice(0, 10); // Top 10 locations

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border rounded-lg shadow-lg p-3">
          <p className="font-medium">{data.fullName}</p>
          <p className="text-sm text-muted-foreground">{data.name}</p>
          <div className="mt-2 space-y-1">
            <p className="text-sm">
              <span className="font-medium text-green-600">Used:</span> {data.used.toFixed(1)} units
            </p>
            <p className="text-sm">
              <span className="font-medium text-gray-600">Available:</span> {data.available.toFixed(1)} units
            </p>
            <p className="text-sm">
              <span className="font-medium">Capacity:</span> {data.capacity.toFixed(1)} units
            </p>
            <p className="text-sm font-bold">
              Utilization: {data.utilization.toFixed(1)}%
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Location Utilization</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            No capacity data available. Add capacity information to locations to see utilization.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Location Utilization Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 70 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="name" 
              angle={-45} 
              textAnchor="end" 
              height={100}
              tick={{ fontSize: 12 }}
            />
            <YAxis 
              label={{ value: 'Storage Units', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar 
              dataKey="used" 
              stackId="a" 
              fill="hsl(var(--primary))" 
              name="Used Space"
            />
            <Bar 
              dataKey="available" 
              stackId="a" 
              fill="hsl(var(--muted))" 
              name="Available Space"
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}