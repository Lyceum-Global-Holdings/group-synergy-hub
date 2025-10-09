import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { usePickPack } from "@/hooks/usePickPack";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { Package, AlertCircle } from "lucide-react";

interface CreateSalesOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cpoId: string;
  customerId: string;
}

export function CreateSalesOrderDialog({ 
  open, 
  onOpenChange, 
  cpoId, 
  customerId 
}: CreateSalesOrderDialogProps) {
  const { createSalesOrderWithItems, isCreatingSalesOrderWithItems } = usePickPack();
  const { selectedCompany } = useCompany();
  
  const [requiredDate, setRequiredDate] = useState("");
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [cpoItems, setCpoItems] = useState<any[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  // Fetch CPO items when dialog opens
  useEffect(() => {
    if (open && cpoId) {
      fetchCpoItems();
    }
  }, [open, cpoId]);

  const fetchCpoItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('customer_po_items')
        .select(`
          *,
          finished_goods (
            id,
            product_name,
            product_code,
            current_stock,
            available_stock
          )
        `)
        .eq('cpo_id', cpoId);

      if (error) throw error;
      
      setCpoItems(data || []);
      
      // Initialize all items as selected with their full quantity
      const allItemIds = new Set(data?.map(item => item.id) || []);
      const quantities: Record<string, number> = {};
      data?.forEach(item => {
        quantities[item.id] = item.quantity_ordered;
      });
      
      setSelectedItems(allItemIds);
      setItemQuantities(quantities);
    } catch (error) {
      console.error('Error fetching CPO items:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleItemSelection = (itemId: string) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(itemId)) {
      newSelection.delete(itemId);
    } else {
      newSelection.add(itemId);
    }
    setSelectedItems(newSelection);
  };

  const updateItemQuantity = (itemId: string, quantity: number) => {
    setItemQuantities({
      ...itemQuantities,
      [itemId]: quantity
    });
  };

  const getStockStatus = (item: any) => {
    const stock = item.finished_goods?.current_stock || 0;
    const required = itemQuantities[item.id] || 0;
    
    if (stock >= required) {
      return <Badge variant="default" className="bg-success">In Stock</Badge>;
    } else if (stock > 0) {
      return <Badge variant="outline" className="border-warning text-warning">Low Stock</Badge>;
    } else {
      return <Badge variant="destructive">Out of Stock</Badge>;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const items = Array.from(selectedItems).map(itemId => {
      const cpoItem = cpoItems.find(i => i.id === itemId);
      return {
        cpo_item_id: itemId,
        finished_good_id: cpoItem?.finished_good_id,
        item_name: cpoItem?.item_name,
        description: cpoItem?.description,
        quantity_ordered: itemQuantities[itemId] || 0,
        unit_price: cpoItem?.unit_price,
        total_price: (itemQuantities[itemId] || 0) * (cpoItem?.unit_price || 0)
      };
    });

    if (items.length === 0) {
      alert('Please select at least one item');
      return;
    }

    createSalesOrderWithItems(
      {
        orderData: {
          cpo_id: cpoId,
          customer_id: customerId,
          required_date: requiredDate || undefined,
          priority,
          delivery_address: deliveryAddress || undefined,
          special_instructions: specialInstructions || undefined,
          company_id: selectedCompany?.id
        },
        items
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          resetForm();
        }
      }
    );
  };

  const resetForm = () => {
    setRequiredDate("");
    setPriority('medium');
    setDeliveryAddress("");
    setSpecialInstructions("");
    setCpoItems([]);
    setSelectedItems(new Set());
    setItemQuantities({});
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Sales Order from CPO</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="required-date">Required Date</Label>
              <Input
                id="required-date"
                type="date"
                value={requiredDate}
                onChange={(e) => setRequiredDate(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select value={priority} onValueChange={(value: any) => setPriority(value)}>
                <SelectTrigger id="priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Select Items to Fulfill</Label>
            <div className="border rounded-lg p-4 space-y-3 max-h-96 overflow-y-auto">
              {loading ? (
                <div className="text-center py-4">Loading items...</div>
              ) : cpoItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="w-12 h-12 mx-auto mb-2" />
                  <p>No items found in this CPO</p>
                </div>
              ) : (
                cpoItems.map((item) => (
                  <div key={item.id} className="border rounded p-3 space-y-2">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedItems.has(item.id)}
                        onCheckedChange={() => toggleItemSelection(item.id)}
                      />
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium">{item.item_name}</div>
                            <div className="text-sm text-muted-foreground">
                              {item.finished_goods?.product_code}
                            </div>
                          </div>
                          {getStockStatus(item)}
                        </div>

                        {selectedItems.has(item.id) && (
                          <div className="mt-2 grid grid-cols-3 gap-3 text-sm">
                            <div>
                              <Label className="text-xs">Ordered Qty</Label>
                              <div className="font-semibold">{item.quantity_ordered}</div>
                            </div>
                            <div>
                              <Label className="text-xs">Available Stock</Label>
                              <div className="font-semibold">
                                {item.finished_goods?.current_stock || 0}
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs">Qty to Fulfill</Label>
                              <Input
                                type="number"
                                min="0"
                                max={item.quantity_ordered}
                                value={itemQuantities[item.id] || 0}
                                onChange={(e) => updateItemQuantity(item.id, parseFloat(e.target.value) || 0)}
                                className="h-8"
                              />
                            </div>
                          </div>
                        )}

                        {selectedItems.has(item.id) && 
                         (itemQuantities[item.id] || 0) > (item.finished_goods?.current_stock || 0) && (
                          <div className="mt-2 flex items-center gap-2 text-sm text-warning">
                            <AlertCircle className="w-4 h-4" />
                            <span>Insufficient stock - will need to issue later</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="delivery-address">Delivery Address</Label>
            <Textarea
              id="delivery-address"
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              placeholder="Enter delivery address..."
              rows={2}
            />
          </div>

          <div>
            <Label htmlFor="special-instructions">Special Instructions</Label>
            <Textarea
              id="special-instructions"
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              placeholder="Enter any special instructions..."
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isCreatingSalesOrderWithItems || selectedItems.size === 0}>
              Create Sales Order ({selectedItems.size} items)
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
