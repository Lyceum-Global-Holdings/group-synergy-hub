import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Building2, DoorOpen, Package, TrendingUp } from "lucide-react";
import { ConstructionProject } from "@/types/construction";
import { useFloorWiseStockAllocation, FloorStockSummary, RoomStockSummary } from "@/hooks/construction/useFloorWiseStockAllocation";

interface FloorWiseStockAllocationDialogProps {
  project: ConstructionProject | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FloorWiseStockAllocationDialog({
  project,
  open,
  onOpenChange,
}: FloorWiseStockAllocationDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const { data, isLoading } = useFloorWiseStockAllocation(project?.id || null);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("en-US").format(num);
  };

  // Filter floors and rooms based on search term
  const filteredFloors = useMemo(() => {
    if (!data?.floors) return [];
    if (!searchTerm.trim()) return data.floors;

    const term = searchTerm.toLowerCase();
    return data.floors
      .map((floor) => {
        const filteredRooms = floor.rooms
          .map((room) => {
            const filteredMaterials = room.materials.filter(
              (mat) =>
                mat.itemCode.toLowerCase().includes(term) ||
                mat.itemName.toLowerCase().includes(term)
            );
            if (filteredMaterials.length > 0) {
              return { ...room, materials: filteredMaterials };
            }
            if (room.roomName.toLowerCase().includes(term)) {
              return room;
            }
            return null;
          })
          .filter(Boolean) as RoomStockSummary[];

        if (filteredRooms.length > 0) {
          return { ...floor, rooms: filteredRooms };
        }
        if (floor.floorName.toLowerCase().includes(term)) {
          return floor;
        }
        return null;
      })
      .filter(Boolean) as FloorStockSummary[];
  }, [data?.floors, searchTerm]);

  const getAllocationStatus = (allocated: number, required: number) => {
    if (required === 0) return { label: "N/A", variant: "secondary" as const };
    const percentage = (allocated / required) * 100;
    if (percentage >= 100) return { label: "Full", variant: "default" as const };
    if (percentage >= 50) return { label: "Partial", variant: "outline" as const };
    return { label: "Low", variant: "destructive" as const };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Floor-wise Stock Allocation - {project?.project_name}
          </DialogTitle>
        </DialogHeader>

        {/* Summary Cards */}
        {data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Floors</span>
                </div>
                <p className="text-2xl font-bold">{data.grandTotals.floorsCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <DoorOpen className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Rooms</span>
                </div>
                <p className="text-2xl font-bold">{data.grandTotals.roomsCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Materials</span>
                </div>
                <p className="text-2xl font-bold">{data.grandTotals.materialsCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Total Cost</span>
                </div>
                <p className="text-2xl font-bold">{formatCurrency(data.grandTotals.totalCost)}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search floors, rooms, or materials..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : !data || filteredFloors.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm
                ? "No matching floors, rooms, or materials found."
                : "No floor data available for this project."}
            </div>
          ) : (
            <Accordion type="multiple" className="space-y-2">
              {filteredFloors.map((floor) => (
                <AccordionItem
                  key={floor.floorId}
                  value={floor.floorId}
                  className="border rounded-lg px-4"
                >
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="font-mono">
                          F{floor.floorNumber}
                        </Badge>
                        <span className="font-medium">{floor.floorName}</span>
                        <span className="text-sm text-muted-foreground">
                          ({floor.totalRooms} rooms)
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span>
                          <span className="text-muted-foreground">Materials:</span>{" "}
                          <span className="font-medium">{floor.totals.materialsCount}</span>
                        </span>
                        <span>
                          <span className="text-muted-foreground">Allocated:</span>{" "}
                          <span className="font-medium">{formatNumber(floor.totals.quantityAllocated)}</span>
                        </span>
                        <span>
                          <span className="text-muted-foreground">Used:</span>{" "}
                          <span className="font-medium">{formatNumber(floor.totals.quantityUsed)}</span>
                        </span>
                        <span className="font-medium text-primary">
                          {formatCurrency(floor.totals.totalCost)}
                        </span>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-2">
                      {floor.rooms.map((room) => (
                        <Card key={room.roomId}>
                          <CardHeader className="py-3">
                            <CardTitle className="text-sm flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <DoorOpen className="h-4 w-4" />
                                {room.roomName}
                                {room.roomType && (
                                  <Badge variant="secondary" className="text-xs">
                                    {room.roomType}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-xs font-normal">
                                <span>
                                  <span className="text-muted-foreground">Materials:</span>{" "}
                                  {room.totals.materialsCount}
                                </span>
                                <span className="text-primary font-medium">
                                  {formatCurrency(room.totals.totalCost)}
                                </span>
                              </div>
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-0">
                            {room.materials.length === 0 ? (
                              <p className="text-sm text-muted-foreground text-center py-2">
                                No materials allocated
                              </p>
                            ) : (
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Item Code</TableHead>
                                    <TableHead>Material Name</TableHead>
                                    <TableHead>Unit</TableHead>
                                    <TableHead className="text-right">Required</TableHead>
                                    <TableHead className="text-right">Allocated</TableHead>
                                    <TableHead className="text-right">Used</TableHead>
                                    <TableHead className="text-right">Returned</TableHead>
                                    <TableHead className="text-right">Cost</TableHead>
                                    <TableHead>Status</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {room.materials.map((material) => {
                                    const status = getAllocationStatus(
                                      material.quantityAllocated,
                                      material.quantityRequired
                                    );
                                    return (
                                      <TableRow key={material.id}>
                                        <TableCell className="font-mono text-xs">
                                          {material.itemCode}
                                        </TableCell>
                                        <TableCell>{material.itemName}</TableCell>
                                        <TableCell>{material.unit}</TableCell>
                                        <TableCell className="text-right">
                                          {formatNumber(material.quantityRequired)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                          {formatNumber(material.quantityAllocated)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                          {formatNumber(material.quantityUsed)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                          {formatNumber(material.quantityReturned)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                          {formatCurrency(material.totalCost)}
                                        </TableCell>
                                        <TableCell>
                                          <Badge variant={status.variant}>
                                            {status.label}
                                          </Badge>
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
