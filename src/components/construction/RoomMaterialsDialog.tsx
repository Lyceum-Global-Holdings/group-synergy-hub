import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Package, Loader2 } from 'lucide-react';
import { FloorDrawingRoom, ROOM_MATERIAL_STATUSES, RoomMaterialStatus } from '@/types/construction';
import {
  useRoomMaterials,
  useCreateRoomMaterial,
  useUpdateRoomMaterial,
  useDeleteRoomMaterial,
} from '@/hooks/construction/useRoomMaterials';
import { ItemSelector } from '@/components/common/ItemSelector';
import { useCompany } from '@/contexts/CompanyContext';

interface RoomMaterialsDialogProps {
  room: FloorDrawingRoom | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RoomMaterialsDialog({ room, open, onOpenChange }: RoomMaterialsDialogProps) {
  const { selectedCompany } = useCompany();
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedItemCost, setSelectedItemCost] = useState<number>(0);
  const [quantityRequired, setQuantityRequired] = useState<string>('1');
  const [notes, setNotes] = useState<string>('');

  const { data: materials = [], isLoading } = useRoomMaterials(room?.id || null);
  const createMaterial = useCreateRoomMaterial();
  const updateMaterial = useUpdateRoomMaterial();
  const deleteMaterial = useDeleteRoomMaterial();

  const handleAddMaterial = () => {
    if (!room || !selectedItemId) return;

    createMaterial.mutate(
      {
        room_id: room.id,
        warehouse_item_id: selectedItemId,
        company_id: selectedCompany?.id || undefined,
        quantity_required: parseFloat(quantityRequired) || 1,
        unit_cost: selectedItemCost || undefined,
        notes: notes || undefined,
      },
      {
        onSuccess: () => {
          setShowAddForm(false);
          setSelectedItemId(null);
          setSelectedItemCost(0);
          setQuantityRequired('1');
          setNotes('');
        },
      }
    );
  };

  const handleStatusChange = (materialId: string, status: RoomMaterialStatus) => {
    if (!room) return;
    updateMaterial.mutate({
      id: materialId,
      room_id: room.id,
      status,
    });
  };

  const handleDelete = (materialId: string) => {
    if (!room) return;
    deleteMaterial.mutate({ id: materialId, room_id: room.id });
  };

  const totalCost = materials.reduce((sum, m) => sum + (m.total_cost || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Room Materials - {room?.room_name || 'Unknown Room'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add Material Button/Form */}
          {!showAddForm ? (
            <Button onClick={() => setShowAddForm(true)} size="sm" className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Add Material
            </Button>
          ) : (
            <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
              <div className="space-y-2">
                <Label>Select Item from Item Master</Label>
                <ItemSelector
                  value={selectedItemId}
                  onSelect={(item) => {
                    setSelectedItemId(item?.id || null);
                    setSelectedItemCost(item?.unit_cost || 0);
                  }}
                  placeholder="Search and select item..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Quantity Required</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.001"
                    value={quantityRequired}
                    onChange={(e) => setQuantityRequired(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unit Cost</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={selectedItemCost}
                    onChange={(e) => setSelectedItemCost(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notes (Optional)</Label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes..."
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowAddForm(false);
                    setSelectedItemId(null);
                    setSelectedItemCost(0);
                    setQuantityRequired('1');
                    setNotes('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleAddMaterial}
                  disabled={!selectedItemId || createMaterial.isPending}
                >
                  {createMaterial.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Add Material
                </Button>
              </div>
            </div>
          )}

          {/* Materials List */}
          <ScrollArea className="h-[400px]">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : materials.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No materials allocated to this room yet
              </div>
            ) : (
              <div className="space-y-3">
                {materials.map((material) => {
                  const statusInfo = ROOM_MATERIAL_STATUSES.find((s) => s.value === material.status);
                  return (
                    <div
                      key={material.id}
                      className="border rounded-lg p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-medium">
                            {material.warehouse_item?.item_code} - {material.warehouse_item?.name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Stock: {material.warehouse_item?.current_stock ?? 0}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Select
                            value={material.status}
                            onValueChange={(value) =>
                              handleStatusChange(material.id, value as RoomMaterialStatus)
                            }
                          >
                            <SelectTrigger className="w-[140px] h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROOM_MATERIAL_STATUSES.map((status) => (
                                <SelectItem key={status.value} value={status.value}>
                                  {status.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(material.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Required:</span>{' '}
                          <span className="font-medium">{material.quantity_required}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Allocated:</span>{' '}
                          <span className="font-medium">{material.quantity_allocated || 0}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Used:</span>{' '}
                          <span className="font-medium">{material.quantity_used || 0}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Est. Cost:</span>{' '}
                          <span className="font-medium">
                            ${(material.total_cost || 0).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {material.notes && (
                        <div className="text-sm text-muted-foreground">
                          Notes: {material.notes}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Summary Footer */}
          <div className="border-t pt-4 flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              Total Materials: <span className="font-medium">{materials.length} items</span>
            </div>
            <div className="text-sm">
              Total Estimated Cost:{' '}
              <span className="font-semibold text-primary">
                ${totalCost.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
