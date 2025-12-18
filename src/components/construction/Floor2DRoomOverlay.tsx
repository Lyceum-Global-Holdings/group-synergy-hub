import { useState } from "react";
import { FloorDrawingRoom } from "@/types/construction";

interface Floor2DRoomOverlayProps {
  imageUrl: string;
  rooms: FloorDrawingRoom[];
  selectedRoomId?: string | null;
  onRoomClick?: (roomId: string) => void;
}

export function Floor2DRoomOverlay({ 
  imageUrl, 
  rooms, 
  selectedRoomId,
  onRoomClick 
}: Floor2DRoomOverlayProps) {
  const [hoveredRoomId, setHoveredRoomId] = useState<string | null>(null);

  return (
    <div className="relative w-full">
      {/* Floor Plan Image */}
      <img
        src={imageUrl}
        alt="Floor plan"
        className="w-full h-auto"
      />
      
      {/* Room Overlays */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {rooms.map((room) => {
          if (room.center_x === null || room.center_y === null || 
              room.width_percent === null || room.height_percent === null) {
            return null;
          }

          const x = room.center_x - room.width_percent / 2;
          const y = room.center_y - room.height_percent / 2;
          const isSelected = selectedRoomId === room.id;
          const isHovered = hoveredRoomId === room.id;

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
                className="pointer-events-auto cursor-pointer transition-all"
                onMouseEnter={() => setHoveredRoomId(room.id)}
                onMouseLeave={() => setHoveredRoomId(null)}
                onClick={() => onRoomClick?.(room.id)}
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
      </svg>
    </div>
  );
}
