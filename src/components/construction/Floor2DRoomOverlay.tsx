import { useState, useRef, useCallback } from "react";
import { FloorDrawingRoom, RoomCoordinate } from "@/types/construction";

interface Floor2DRoomOverlayProps {
  imageUrl: string;
  rooms: FloorDrawingRoom[];
  selectedRoomId?: string | null;
  onRoomClick?: (roomId: string) => void;
  isDrawingMode?: boolean;
  drawingPoints?: RoomCoordinate[];
  onPointAdd?: (point: RoomCoordinate) => void;
  onPolygonComplete?: () => void;
}

// Calculate centroid of a polygon for label positioning
function getPolygonCentroid(coordinates: RoomCoordinate[]): { x: number; y: number } {
  const n = coordinates.length;
  if (n === 0) return { x: 50, y: 50 };
  const centroidX = coordinates.reduce((sum, p) => sum + p.x, 0) / n;
  const centroidY = coordinates.reduce((sum, p) => sum + p.y, 0) / n;
  return { x: centroidX, y: centroidY };
}

export function Floor2DRoomOverlay({ 
  imageUrl, 
  rooms, 
  selectedRoomId,
  onRoomClick,
  isDrawingMode = false,
  drawingPoints = [],
  onPointAdd,
  onPolygonComplete,
}: Floor2DRoomOverlayProps) {
  const [hoveredRoomId, setHoveredRoomId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDrawingMode || !onPointAdd) return;

    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    
    // Calculate percentage position
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    // Check if clicking near first point to close polygon
    if (drawingPoints.length >= 3) {
      const firstPoint = drawingPoints[0];
      const distance = Math.sqrt(
        Math.pow(x - firstPoint.x, 2) + Math.pow(y - firstPoint.y, 2)
      );
      if (distance < 3) {
        onPolygonComplete?.();
        return;
      }
    }

    onPointAdd({ x, y });
  }, [isDrawingMode, onPointAdd, drawingPoints, onPolygonComplete]);

  const handleDoubleClick = useCallback(() => {
    if (isDrawingMode && drawingPoints.length >= 3 && onPolygonComplete) {
      onPolygonComplete();
    }
  }, [isDrawingMode, drawingPoints.length, onPolygonComplete]);

  // Create polygon path from drawing points
  const drawingPath = drawingPoints.length > 0
    ? drawingPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
    : '';

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Floor Plan Image */}
      <img
        src={imageUrl}
        alt="Floor plan"
        className="w-full h-auto"
        draggable={false}
      />
      
      {/* Room Overlays & Drawing Layer */}
      <svg
        className={`absolute inset-0 w-full h-full ${
          isDrawingMode ? 'cursor-crosshair' : 'pointer-events-none'
        }`}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        {/* Existing Rooms */}
        {rooms.map((room) => {
          const hasPolygonCoords = room.coordinates && Array.isArray(room.coordinates) && room.coordinates.length >= 3;
          const isSelected = selectedRoomId === room.id;
          const isHovered = hoveredRoomId === room.id;

          // For polygon rooms (manually drawn), use coordinates
          if (hasPolygonCoords) {
            const coords = room.coordinates as RoomCoordinate[];
            const pathD = coords.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
            const centroid = getPolygonCentroid(coords);

            return (
              <g key={room.id}>
                {/* Room Polygon */}
                <path
                  d={pathD}
                  fill={room.color || '#6366F1'}
                  fillOpacity={isSelected ? 0.4 : isHovered ? 0.3 : 0.2}
                  stroke={room.color || '#6366F1'}
                  strokeWidth={isSelected ? 0.5 : 0.3}
                  strokeOpacity={isSelected ? 1 : 0.8}
                  className={`${isDrawingMode ? '' : 'pointer-events-auto cursor-pointer'} transition-all`}
                  onMouseEnter={() => !isDrawingMode && setHoveredRoomId(room.id)}
                  onMouseLeave={() => !isDrawingMode && setHoveredRoomId(null)}
                  onClick={(e) => {
                    if (!isDrawingMode) {
                      e.stopPropagation();
                      onRoomClick?.(room.id);
                    }
                  }}
                />
                
                {/* Room Label Background */}
                <rect
                  x={centroid.x - 8}
                  y={centroid.y - 2.5}
                  width={16}
                  height={5}
                  fill="white"
                  fillOpacity={0.9}
                  rx={0.5}
                />
                
                {/* Room Label */}
                <text
                  x={centroid.x}
                  y={centroid.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={2.5}
                  fontWeight={isSelected ? 600 : 500}
                  fill={room.color || '#6366F1'}
                  className="pointer-events-none select-none"
                >
                  {room.room_name.length > 12 
                    ? room.room_name.substring(0, 12) + '...' 
                    : room.room_name}
                </text>
                
                {/* Area Label */}
                {room.area_sqm && (
                  <text
                    x={centroid.x}
                    y={centroid.y + 3.5}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={1.8}
                    fill="#666"
                    className="pointer-events-none select-none"
                  >
                    {room.area_sqm.toFixed(1)} sqm
                  </text>
                )}
              </g>
            );
          }

          // For rectangle rooms (AI-detected), use center + dimensions
          if (room.center_x === null || room.center_y === null || 
              room.width_percent === null || room.height_percent === null) {
            return null;
          }

          const x = room.center_x - room.width_percent / 2;
          const y = room.center_y - room.height_percent / 2;

          return (
            <g key={room.id}>
              {/* Room Rectangle */}
              <rect
                x={x}
                y={y}
                width={room.width_percent}
                height={room.height_percent}
                fill={room.color || '#6366F1'}
                fillOpacity={isSelected ? 0.4 : isHovered ? 0.3 : 0.2}
                stroke={room.color || '#6366F1'}
                strokeWidth={isSelected ? 0.5 : 0.3}
                strokeOpacity={isSelected ? 1 : 0.8}
                className={`${isDrawingMode ? '' : 'pointer-events-auto cursor-pointer'} transition-all`}
                onMouseEnter={() => !isDrawingMode && setHoveredRoomId(room.id)}
                onMouseLeave={() => !isDrawingMode && setHoveredRoomId(null)}
                onClick={(e) => {
                  if (!isDrawingMode) {
                    e.stopPropagation();
                    onRoomClick?.(room.id);
                  }
                }}
              />
              
              {/* Room Label Background */}
              <rect
                x={room.center_x - 8}
                y={room.center_y - 2.5}
                width={16}
                height={5}
                fill="white"
                fillOpacity={0.9}
                rx={0.5}
              />
              
              {/* Room Label */}
              <text
                x={room.center_x}
                y={room.center_y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={2.5}
                fontWeight={isSelected ? 600 : 500}
                fill={room.color || '#6366F1'}
                className="pointer-events-none select-none"
              >
                {room.room_name.length > 12 
                  ? room.room_name.substring(0, 12) + '...' 
                  : room.room_name}
              </text>
              
              {/* Area Label */}
              {room.area_sqm && (
                <text
                  x={room.center_x}
                  y={room.center_y + 3.5}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={1.8}
                  fill="#666"
                  className="pointer-events-none select-none"
                >
                  {room.area_sqm.toFixed(1)} sqm
                </text>
              )}
            </g>
          );
        })}

        {/* Drawing Preview */}
        {isDrawingMode && drawingPoints.length > 0 && (
          <g>
            {/* Polygon outline */}
            <path
              d={drawingPath}
              fill="#6366F1"
              fillOpacity={0.15}
              stroke="#6366F1"
              strokeWidth={0.4}
              strokeDasharray="1,0.5"
            />
            
            {/* Line to close polygon (preview) */}
            {drawingPoints.length >= 2 && (
              <line
                x1={drawingPoints[drawingPoints.length - 1].x}
                y1={drawingPoints[drawingPoints.length - 1].y}
                x2={drawingPoints[0].x}
                y2={drawingPoints[0].y}
                stroke="#6366F1"
                strokeWidth={0.2}
                strokeDasharray="0.5,0.5"
                strokeOpacity={0.5}
              />
            )}

            {/* Points */}
            {drawingPoints.map((point, index) => (
              <circle
                key={index}
                cx={point.x}
                cy={point.y}
                r={index === 0 && drawingPoints.length >= 3 ? 1.5 : 1}
                fill={index === 0 ? "#22C55E" : "#6366F1"}
                stroke="white"
                strokeWidth={0.3}
                className={index === 0 && drawingPoints.length >= 3 ? "cursor-pointer" : ""}
              />
            ))}
          </g>
        )}
      </svg>

      {/* Drawing Mode Instructions */}
      {isDrawingMode && (
        <div className="absolute bottom-2 left-2 right-2 bg-background/90 backdrop-blur-sm rounded-lg p-2 text-center text-sm">
          {drawingPoints.length === 0 ? (
            <span>Click to place the first corner of the room</span>
          ) : drawingPoints.length < 3 ? (
            <span>Click to add more corners ({drawingPoints.length}/3 minimum)</span>
          ) : (
            <span>
              Click the <span className="text-green-500 font-medium">green point</span> or double-click to complete
            </span>
          )}
        </div>
      )}
    </div>
  );
}
