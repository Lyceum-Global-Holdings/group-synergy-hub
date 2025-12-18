import { Suspense, useEffect, useState } from "react";
import { Canvas, useLoader, useThree } from "@react-three/fiber";
import { OrbitControls, Environment, Grid, Html } from "@react-three/drei";
import * as THREE from "three";
import { FloorDrawing, FloorDrawingRoom } from "@/types/construction";
import { useFloorDrawingRooms } from "@/hooks/construction/useFloorRooms";

interface FloorPlan3DViewerProps {
  drawing: FloorDrawing;
}

function FloorPlanMesh({ imageUrl, wallHeight, rooms, dimensions }: { 
  imageUrl: string; 
  wallHeight: number;
  rooms: FloorDrawingRoom[];
  dimensions: { width: number; height: number };
}) {
  const texture = useLoader(THREE.TextureLoader, imageUrl);
  const { width, height } = dimensions;

  return (
    <group>
      {/* Floor with texture */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial map={texture} side={THREE.DoubleSide} />
      </mesh>

      {/* Room Labels on floor */}
      {rooms.map((room) => {
        if (room.center_x === null || room.center_y === null) return null;
        
        // Convert percentage positions to world coordinates
        const x = ((room.center_x / 100) - 0.5) * width;
        const z = ((room.center_y / 100) - 0.5) * height;
        
        return (
          <Html
            key={room.id}
            position={[x, 0.1, z]}
            center
            distanceFactor={8}
            occlude={false}
          >
            <div 
              className="px-2 py-1 rounded text-xs font-medium whitespace-nowrap pointer-events-none"
              style={{ 
                backgroundColor: room.color || '#6366F1',
                color: 'white',
                opacity: 0.9,
              }}
            >
              {room.room_name}
              {room.area_sqm && (
                <span className="block text-[10px] opacity-80">
                  {room.area_sqm.toFixed(1)} sqm
                </span>
              )}
            </div>
          </Html>
        );
      })}

      {/* Walls */}
      <Wall
        position={[0, wallHeight / 2, -height / 2]}
        rotation={[0, 0, 0]}
        width={width}
        height={wallHeight}
      />
      <Wall
        position={[0, wallHeight / 2, height / 2]}
        rotation={[0, Math.PI, 0]}
        width={width}
        height={wallHeight}
      />
      <Wall
        position={[-width / 2, wallHeight / 2, 0]}
        rotation={[0, Math.PI / 2, 0]}
        width={height}
        height={wallHeight}
      />
      <Wall
        position={[width / 2, wallHeight / 2, 0]}
        rotation={[0, -Math.PI / 2, 0]}
        width={height}
        height={wallHeight}
      />
    </group>
  );
}

function Wall({
  position,
  rotation,
  width,
  height,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  width: number;
  height: number;
}) {
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial
        color="#e5e5e5"
        side={THREE.DoubleSide}
        transparent
        opacity={0.7}
      />
    </mesh>
  );
}

function Scene({ drawing, rooms }: { drawing: FloorDrawing; rooms: FloorDrawingRoom[] }) {
  const { camera } = useThree();
  const texture = useLoader(THREE.TextureLoader, drawing.image_url);
  const [dimensions, setDimensions] = useState({ width: 10, height: 10 });

  useEffect(() => {
    if (texture.image) {
      const aspectRatio = texture.image.width / texture.image.height;
      const baseSize = 10;
      if (aspectRatio > 1) {
        setDimensions({ width: baseSize, height: baseSize / aspectRatio });
      } else {
        setDimensions({ width: baseSize * aspectRatio, height: baseSize });
      }
    }
  }, [texture]);

  useEffect(() => {
    camera.position.set(8, 8, 8);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
      <pointLight position={[-10, 10, -5]} intensity={0.5} />

      <Suspense fallback={<LoadingFallback />}>
        <FloorPlanMesh
          imageUrl={drawing.image_url}
          wallHeight={drawing.wall_height}
          rooms={rooms}
          dimensions={dimensions}
        />
      </Suspense>

      <Grid
        position={[0, 0, 0]}
        args={[20, 20]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#6b7280"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#374151"
        fadeDistance={30}
        fadeStrength={1}
        followCamera={false}
      />

      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minPolarAngle={0}
        maxPolarAngle={Math.PI / 2.1}
        minDistance={3}
        maxDistance={30}
      />

      <Environment preset="city" />
    </>
  );
}

function LoadingFallback() {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#888" wireframe />
    </mesh>
  );
}

export function FloorPlan3DViewer({ drawing }: FloorPlan3DViewerProps) {
  const { data: rooms = [] } = useFloorDrawingRooms(drawing.id);

  return (
    <div className="w-full h-full min-h-[500px] bg-gradient-to-b from-slate-900 to-slate-800 rounded-lg overflow-hidden">
      <Canvas shadows camera={{ fov: 50, near: 0.1, far: 100 }}>
        <Scene drawing={drawing} rooms={rooms} />
      </Canvas>
    </div>
  );
}
