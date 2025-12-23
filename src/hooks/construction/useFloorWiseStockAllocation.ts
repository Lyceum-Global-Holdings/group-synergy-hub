import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MaterialDetail {
  id: string;
  itemCode: string;
  itemName: string;
  unit: string;
  quantityRequired: number;
  quantityAllocated: number;
  quantityUsed: number;
  quantityReturned: number;
  unitCost: number;
  totalCost: number;
}

export interface RoomStockSummary {
  roomId: string;
  roomName: string;
  roomType: string | null;
  materials: MaterialDetail[];
  totals: {
    materialsCount: number;
    quantityRequired: number;
    quantityAllocated: number;
    quantityUsed: number;
    quantityReturned: number;
    totalCost: number;
  };
}

export interface FloorStockSummary {
  floorId: string;
  floorName: string;
  floorNumber: number;
  totalRooms: number;
  rooms: RoomStockSummary[];
  totals: {
    materialsCount: number;
    quantityRequired: number;
    quantityAllocated: number;
    quantityUsed: number;
    quantityReturned: number;
    totalCost: number;
  };
}

export interface FloorWiseStockAllocation {
  projectId: string;
  projectName: string;
  floors: FloorStockSummary[];
  grandTotals: {
    floorsCount: number;
    roomsCount: number;
    materialsCount: number;
    quantityRequired: number;
    quantityAllocated: number;
    quantityUsed: number;
    quantityReturned: number;
    totalCost: number;
  };
}

interface FloorRow {
  id: string;
  drawing_name: string;
  floor_number: number | null;
}

interface RoomRow {
  id: string;
  room_name: string;
  room_type: string | null;
  floor_drawing_id: string;
}

interface WarehouseItemData {
  id: string;
  item_code: string;
  name: string;
  unit_id: string | null;
}

interface MaterialRow {
  id: string;
  room_id: string;
  quantity_required: number;
  quantity_allocated: number | null;
  unit_cost: number | null;
  total_cost: number | null;
  warehouse_item: WarehouseItemData | null;
}

interface TransactionRow {
  room_material_id: string;
  transaction_type: string;
  quantity: number;
}

export function useFloorWiseStockAllocation(projectId: string | null) {
  return useQuery({
    queryKey: ["floor-wise-stock-allocation", projectId],
    queryFn: async (): Promise<FloorWiseStockAllocation | null> => {
      if (!projectId) return null;

      // Fetch floors for the project
      const { data: floorsData, error: floorsError } = await supabase
        .from("project_floor_drawings")
        .select("id, drawing_name, floor_number")
        .eq("project_id", projectId)
        .order("floor_number", { ascending: true });

      if (floorsError) throw floorsError;
      if (!floorsData || floorsData.length === 0) return null;

      const floors = floorsData as FloorRow[];
      const floorIds = floors.map((f) => f.id);

      // Fetch all rooms for these floors
      const { data: roomsData, error: roomsError } = await supabase
        .from("floor_drawing_rooms")
        .select("id, room_name, room_type, floor_drawing_id")
        .in("floor_drawing_id", floorIds);

      if (roomsError) throw roomsError;

      const rooms = (roomsData || []) as RoomRow[];
      const roomIds = rooms.map((r) => r.id);

      // Fetch all materials for these rooms
      const { data: materialsData, error: materialsError } = await supabase
        .from("floor_room_materials")
        .select(`
          id,
          room_id,
          quantity_required,
          quantity_allocated,
          unit_cost,
          total_cost,
          warehouse_item:warehouse_items(
            id,
            item_code,
            name,
            unit_id
          )
        `)
        .in("room_id", roomIds.length > 0 ? roomIds : ["no-rooms"]);

      if (materialsError) throw materialsError;

      const materials = (materialsData || []) as unknown as MaterialRow[];

      // Fetch all transactions to calculate used/returned quantities
      const { data: transactionsData, error: transactionsError } = await supabase
        .from("floor_room_material_transactions")
        .select("room_material_id, transaction_type, quantity")
        .in(
          "room_material_id",
          materials.map((m) => m.id).length > 0 ? materials.map((m) => m.id) : ["no-materials"]
        );

      if (transactionsError) throw transactionsError;

      const transactions = (transactionsData || []) as TransactionRow[];

      // Aggregate transactions by material
      const transactionsByMaterial: Record<
        string,
        { issued: number; returned: number }
      > = {};
      transactions.forEach((t) => {
        if (!transactionsByMaterial[t.room_material_id]) {
          transactionsByMaterial[t.room_material_id] = { issued: 0, returned: 0 };
        }
        if (t.transaction_type === "issue") {
          transactionsByMaterial[t.room_material_id].issued += t.quantity;
        } else if (t.transaction_type === "return") {
          transactionsByMaterial[t.room_material_id].returned += t.quantity;
        }
      });

      // Build floor summaries
      const floorSummaries: FloorStockSummary[] = floors.map((floor) => {
        const floorRooms = rooms.filter(
          (r) => r.floor_drawing_id === floor.id
        );

        const roomSummaries: RoomStockSummary[] = floorRooms.map((room) => {
          const roomMaterials = materials.filter((m) => m.room_id === room.id);

          const materialDetails: MaterialDetail[] = roomMaterials.map((mat) => {
            const txn = transactionsByMaterial[mat.id] || { issued: 0, returned: 0 };
            const warehouseItem = mat.warehouse_item;

            return {
              id: mat.id,
              itemCode: warehouseItem?.item_code || "N/A",
              itemName: warehouseItem?.name || "Unknown",
              unit: "pcs", // Default unit, could be fetched from item_units if needed
              quantityRequired: mat.quantity_required || 0,
              quantityAllocated: mat.quantity_allocated || 0,
              quantityUsed: txn.issued,
              quantityReturned: txn.returned,
              unitCost: mat.unit_cost || 0,
              totalCost: mat.total_cost || 0,
            };
          });

          const roomTotals = {
            materialsCount: materialDetails.length,
            quantityRequired: materialDetails.reduce((sum, m) => sum + m.quantityRequired, 0),
            quantityAllocated: materialDetails.reduce((sum, m) => sum + m.quantityAllocated, 0),
            quantityUsed: materialDetails.reduce((sum, m) => sum + m.quantityUsed, 0),
            quantityReturned: materialDetails.reduce((sum, m) => sum + m.quantityReturned, 0),
            totalCost: materialDetails.reduce((sum, m) => sum + m.totalCost, 0),
          };

          return {
            roomId: room.id,
            roomName: room.room_name,
            roomType: room.room_type,
            materials: materialDetails,
            totals: roomTotals,
          };
        });

        const floorTotals = {
          materialsCount: roomSummaries.reduce((sum, r) => sum + r.totals.materialsCount, 0),
          quantityRequired: roomSummaries.reduce((sum, r) => sum + r.totals.quantityRequired, 0),
          quantityAllocated: roomSummaries.reduce((sum, r) => sum + r.totals.quantityAllocated, 0),
          quantityUsed: roomSummaries.reduce((sum, r) => sum + r.totals.quantityUsed, 0),
          quantityReturned: roomSummaries.reduce((sum, r) => sum + r.totals.quantityReturned, 0),
          totalCost: roomSummaries.reduce((sum, r) => sum + r.totals.totalCost, 0),
        };

        return {
          floorId: floor.id,
          floorName: floor.drawing_name,
          floorNumber: floor.floor_number || 0,
          totalRooms: roomSummaries.length,
          rooms: roomSummaries,
          totals: floorTotals,
        };
      });

      const grandTotals = {
        floorsCount: floorSummaries.length,
        roomsCount: floorSummaries.reduce((sum, f) => sum + f.totalRooms, 0),
        materialsCount: floorSummaries.reduce((sum, f) => sum + f.totals.materialsCount, 0),
        quantityRequired: floorSummaries.reduce((sum, f) => sum + f.totals.quantityRequired, 0),
        quantityAllocated: floorSummaries.reduce((sum, f) => sum + f.totals.quantityAllocated, 0),
        quantityUsed: floorSummaries.reduce((sum, f) => sum + f.totals.quantityUsed, 0),
        quantityReturned: floorSummaries.reduce((sum, f) => sum + f.totals.quantityReturned, 0),
        totalCost: floorSummaries.reduce((sum, f) => sum + f.totals.totalCost, 0),
      };

      return {
        projectId,
        projectName: "",
        floors: floorSummaries,
        grandTotals,
      };
    },
    enabled: !!projectId,
  });
}
