import { WarehouseLocation } from '@/types/warehouse';

interface CapacityHeatmapCellProps {
  location: WarehouseLocation;
}

export function CapacityHeatmapCell({ location }: CapacityHeatmapCellProps) {
  const utilization = location.capacity 
    ? (location.current_usage || 0) / location.capacity
    : 0;
  const utilizationPercent = (utilization * 100).toFixed(1);
  
  const getColor = () => {
    if (utilization >= 0.9) return 'bg-red-500 hover:bg-red-600';
    if (utilization >= 0.7) return 'bg-yellow-500 hover:bg-yellow-600';
    if (utilization >= 0.5) return 'bg-green-500 hover:bg-green-600';
    return 'bg-blue-500 hover:bg-blue-600';
  };
  
  return (
    <div
      className={`${getColor()} text-white p-4 rounded-lg cursor-pointer transition-all hover:scale-105 shadow-md`}
      title={`${location.name}: ${utilizationPercent}% utilization`}
    >
      <div className="text-xs font-medium truncate mb-1">{location.name}</div>
      <div className="text-2xl font-bold">{utilizationPercent}%</div>
      <div className="text-xs opacity-90 mt-1">
        {location.current_usage || 0} / {location.capacity}
      </div>
      {location.location_code && (
        <div className="text-xs font-mono opacity-75 mt-1">
          {location.location_code}
        </div>
      )}
    </div>
  );
}
