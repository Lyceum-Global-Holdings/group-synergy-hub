import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Package, AlertCircle, CheckCircle, ExternalLink } from "lucide-react";
import { DemandAnalysisResult } from "@/types/materialDemand";
import { useWarehouseReservations } from "@/hooks/useWarehouseReservations";
import { useWarehouseBinAllocations } from "@/hooks/useWarehouseBinAllocations";
import { BulkReservationRequest } from "@/types/warehouseReservation";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

interface ReserveMaterialsFromCPODialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  materials: DemandAnalysisResult[];
  cpoIds: string[];
  cpoNumbers: string[];
  requiredDate: string;
  onReservationComplete: () => void;
}

interface BinOption {
  id: string;
  bin_code: string;
  bin_name: string;
  available_quantity: number;
}

interface ReservationItem {
  material: DemandAnalysisResult;
  selected: boolean;
  bin_allocation_id: string | null;
  reserved_quantity: number;
  binOptions: BinOption[];
}

export function ReserveMaterialsFromCPODialog({
  open,
  onOpenChange,
  materials,
  cpoIds,
  cpoNumbers,
  requiredDate,
  onReservationComplete
}: ReserveMaterialsFromCPODialogProps) {
  const { toast } = useToast();
  const { createBulkReservations, isCreating } = useWarehouseReservations();
  const [reservationItems, setReservationItems] = useState<ReservationItem[]>([]);
  const [isLoadingBins, setIsLoadingBins] = useState(false);

  useEffect(() => {
    if (open && materials.length > 0) {
      loadBinAllocations();
    }
  }, [open, materials]);

  const loadBinAllocations = async () => {
    setIsLoadingBins(true);
    try {
      const items: ReservationItem[] = await Promise.all(
        materials.map(async (material) => {
          if (!material.warehouse_item_id) {
            return {
              material,
              selected: false,
              bin_allocation_id: null,
              reserved_quantity: Math.min(material.shortage, material.available_stock - (material.reserved_quantity || 0)),
              binOptions: []
            };
          }

          const { data: binAllocations, error } = await supabase
            .from('warehouse_bin_allocations')
            .select(`
              id,
              available_quantity,
              bin:warehouse_bins!warehouse_bin_allocations_bin_id_fkey(bin_code, name)
            `)
            .eq('warehouse_item_id', material.warehouse_item_id)
            .gt('available_quantity', 0)
            .order('available_quantity', { ascending: false });

          if (error) {
            console.error('Error fetching bin allocations:', error);
            return {
              material,
              selected: false,
              bin_allocation_id: null,
              reserved_quantity: Math.min(material.shortage, material.available_stock - (material.reserved_quantity || 0)),
              binOptions: []
            };
          }

          const binOptions: BinOption[] = (binAllocations || []).map(ba => ({
            id: ba.id,
            bin_code: (ba.bin as any)?.bin_code || 'N/A',
            bin_name: (ba.bin as any)?.name || 'Unknown',
            available_quantity: ba.available_quantity
          }));

          const maxReservable = Math.min(
            material.shortage,
            material.available_stock - (material.reserved_quantity || 0),
            binOptions[0]?.available_quantity || 0
          );

          return {
            material,
            selected: binOptions.length > 0 && material.shortage > 0,
            bin_allocation_id: binOptions[0]?.id || null,
            reserved_quantity: Math.max(0, maxReservable),
            binOptions
          };
        })
      );

      setReservationItems(items);
    } catch (error) {
      console.error('Error loading bin allocations:', error);
      toast({
        title: "Error",
        description: "Failed to load bin allocations",
        variant: "destructive"
      });
    } finally {
      setIsLoadingBins(false);
    }
  };

  const handleSelectItem = (index: number, selected: boolean) => {
    const updated = [...reservationItems];
    updated[index].selected = selected;
    setReservationItems(updated);
  };

  const handleSelectAll = (checked: boolean) => {
    const updated = reservationItems.map(item => ({
      ...item,
      selected: checked && item.binOptions.length > 0 && item.material.shortage > 0
    }));
    setReservationItems(updated);
  };

  const handleBinChange = (index: number, binId: string) => {
    const updated = [...reservationItems];
    updated[index].bin_allocation_id = binId;
    
    const selectedBin = updated[index].binOptions.find(b => b.id === binId);
    if (selectedBin) {
      const maxReservable = Math.min(
        updated[index].material.shortage,
        updated[index].material.available_stock - (updated[index].material.reserved_quantity || 0),
        selectedBin.available_quantity
      );
      updated[index].reserved_quantity = Math.max(0, maxReservable);
    }
    
    setReservationItems(updated);
  };

  const handleQuantityChange = (index: number, quantity: number) => {
    const updated = [...reservationItems];
    const item = updated[index];
    const selectedBin = item.binOptions.find(b => b.id === item.bin_allocation_id);
    
    const maxReservable = Math.min(
      item.material.shortage,
      item.material.available_stock - (item.material.reserved_quantity || 0),
      selectedBin?.available_quantity || 0
    );
    
    updated[index].reserved_quantity = Math.max(0, Math.min(quantity, maxReservable));
    setReservationItems(updated);
  };

  const handleReserve = async () => {
    const selectedItems = reservationItems.filter(item => item.selected && item.bin_allocation_id && item.reserved_quantity > 0);
    
    if (selectedItems.length === 0) {
      toast({
        title: "No items selected",
        description: "Please select at least one item with a bin and quantity to reserve",
        variant: "destructive"
      });
      return;
    }

    const bulkRequest: BulkReservationRequest = {
      cpo_id: cpoIds[0],
      cpo_number: cpoNumbers.join(', '),
      items: selectedItems.map(item => ({
        warehouse_item_id: item.material.warehouse_item_id!,
        item_code: item.material.item_code,
        item_name: item.material.item_name,
        required_quantity: item.reserved_quantity,
        bin_allocation_id: item.bin_allocation_id!,
        bom_id: item.material.bom_id,
        bom_item_id: item.material.bom_item_id
      })),
      required_date: requiredDate,
      notes: `Reserved from Material Demand Planning for CPO: ${cpoNumbers.join(', ')}`
    };

    createBulkReservations(bulkRequest, {
      onSuccess: () => {
        toast({
          title: "Success",
          description: `Successfully reserved ${selectedItems.length} materials for CPO ${cpoNumbers.join(', ')}`,
        });
        onReservationComplete();
      }
    });
  };

  const allSelected = reservationItems.length > 0 && reservationItems.every(item => item.selected || item.binOptions.length === 0);
  const selectedCount = reservationItems.filter(item => item.selected).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-screen h-screen max-w-none max-h-none rounded-none p-6 overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Reserve Materials for CPO
          </DialogTitle>
          <DialogDescription>
            Select materials to reserve from available bins for CPO: <strong>{cpoNumbers.join(', ')}</strong>
          </DialogDescription>
        </DialogHeader>

        {isLoadingBins ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Loading bin allocations...</div>
          </div>
        ) : (
          <>
            {/* Alert for unlinked warehouse items */}
            {reservationItems.some(item => !item.material.warehouse_item_id) && (
              <Alert className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Some materials are not linked to warehouse items. 
                  Please link them in the Item Master to enable bin allocation.
                </AlertDescription>
              </Alert>
            )}

            {/* Alert for missing bin allocations */}
            {reservationItems.some(item => item.material.warehouse_item_id && item.binOptions.length === 0) && (
              <Alert className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="flex items-center gap-2">
                  Some warehouse items have no bin allocations. 
                  <Link 
                    to="/warehouse/item-bin-master" 
                    target="_blank"
                    className="inline-flex items-center gap-1 underline hover:text-primary"
                  >
                    Go to Item & Bin Master
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                  to allocate items to bins first.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={handleSelectAll}
                />
                <Label>Select All ({selectedCount} selected)</Label>
              </div>
              <Badge variant="secondary">
                {materials.length} materials with shortage
              </Badge>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Item Code</TableHead>
                    <TableHead>Item Name</TableHead>
                    <TableHead>Required</TableHead>
                    <TableHead>Available</TableHead>
                    <TableHead>Reserved</TableHead>
                    <TableHead>Shortage</TableHead>
                    <TableHead>Select Bin</TableHead>
                    <TableHead>Reserve Qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reservationItems.map((item, index) => {
                    const availableUnreserved = Math.max(0, (item.material.available_stock || 0) - (item.material.reserved_quantity || 0));
                    const hasBins = item.binOptions.length > 0;
                    
                    return (
                  <TableRow key={index}>
                        <TableCell>
                          <Checkbox
                            checked={item.selected}
                            onCheckedChange={(checked) => handleSelectItem(index, checked as boolean)}
                            disabled={!hasBins || item.material.shortage <= 0}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{item.material.item_code}</TableCell>
                        <TableCell>
                          <div>
                            {item.material.item_name}
                            {!item.material.warehouse_item_id && (
                              <Badge variant="outline" className="ml-2 text-xs">Not linked</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{item.material.total_required} {item.material.unit_of_measure}</TableCell>
                        <TableCell>
                          <Badge variant={availableUnreserved > 0 ? "default" : "destructive"}>
                            {availableUnreserved.toFixed(2)} {item.material.unit_of_measure}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {(item.material.reserved_quantity || 0).toFixed(2)} {item.material.unit_of_measure}
                        </TableCell>
                        <TableCell>
                          <Badge variant="destructive">
                            {item.material.shortage.toFixed(2)} {item.material.unit_of_measure}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {hasBins ? (
                            <Select
                              value={item.bin_allocation_id || undefined}
                              onValueChange={(value) => handleBinChange(index, value)}
                              disabled={!item.selected}
                            >
                              <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Select bin" />
                              </SelectTrigger>
                              <SelectContent>
                                {item.binOptions.map(bin => (
                                  <SelectItem key={bin.id} value={bin.id}>
                                    {bin.bin_code} - Avail: {bin.available_quantity.toFixed(2)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="text-sm text-muted-foreground">
                              {!item.material.warehouse_item_id ? "Not linked" : "No bins"}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.reserved_quantity}
                            onChange={(e) => handleQuantityChange(index, parseFloat(e.target.value) || 0)}
                            disabled={!item.selected || !item.bin_allocation_id}
                            className="w-24"
                            min={0}
                            step={1}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {reservationItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        No materials available for reservation
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4" />
                <span>Only materials with available stock and bins can be reserved</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button onClick={handleReserve} disabled={selectedCount === 0 || isCreating}>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Reserve {selectedCount} Material{selectedCount !== 1 ? 's' : ''}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
