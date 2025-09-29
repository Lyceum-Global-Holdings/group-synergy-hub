import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2 } from "lucide-react";

interface PrItem {
  item_name: string;
  description: string;
  quantity: number;
  unit_of_measure: string;
  estimated_unit_price: number;
  estimated_total_price: number;
}

interface CreatePrFromCpoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreatePR: (data: {
    title: string;
    department?: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    requiredDate: string;
    justification?: string;
    items: PrItem[];
  }) => void;
  isLoading: boolean;
  cpoNumber: string;
}

export default function CreatePrFromCpoDialog({
  open,
  onOpenChange,
  onCreatePR,
  isLoading,
  cpoNumber,
}: CreatePrFromCpoDialogProps) {
  const [formData, setFormData] = useState({
    title: `Materials for Customer PO ${cpoNumber}`,
    department: "",
    priority: "medium" as 'low' | 'medium' | 'high' | 'urgent',
    requiredDate: "",
    justification: `Material requirements to fulfill Customer PO ${cpoNumber}`,
  });

  const [items, setItems] = useState<PrItem[]>([
    {
      item_name: "",
      description: "",
      quantity: 1,
      unit_of_measure: "pcs",
      estimated_unit_price: 0,
      estimated_total_price: 0,
    },
  ]);

  const addItem = () => {
    setItems([
      ...items,
      {
        item_name: "",
        description: "",
        quantity: 1,
        unit_of_measure: "pcs",
        estimated_unit_price: 0,
        estimated_total_price: 0,
      },
    ]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof PrItem, value: any) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    
    // Recalculate total price
    if (field === 'quantity' || field === 'estimated_unit_price') {
      updatedItems[index].estimated_total_price = 
        updatedItems[index].quantity * updatedItems[index].estimated_unit_price;
    }
    
    setItems(updatedItems);
  };

  const handleSubmit = () => {
    const validItems = items.filter(item => item.item_name.trim());
    if (validItems.length === 0) return;

    onCreatePR({
      ...formData,
      items: validItems,
    });
  };

  const totalEstimatedAmount = items.reduce((sum, item) => sum + item.estimated_total_price, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Purchase Requisition</DialogTitle>
          <DialogDescription>
            Create a Purchase Requisition based on Customer PO {cpoNumber}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* PR Details */}
          <Card>
            <CardHeader>
              <CardTitle>Requisition Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="department">Department</Label>
                  <Input
                    id="department"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    placeholder="e.g., Production, Procurement"
                  />
                </div>

                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(value: 'low' | 'medium' | 'high' | 'urgent') =>
                      setFormData({ ...formData, priority: value })
                    }
                  >
                    <SelectTrigger>
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
                <Label htmlFor="requiredDate">Required Date</Label>
                <Input
                  id="requiredDate"
                  type="date"
                  value={formData.requiredDate}
                  onChange={(e) => setFormData({ ...formData, requiredDate: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="justification">Justification</Label>
                <Textarea
                  id="justification"
                  value={formData.justification}
                  onChange={(e) => setFormData({ ...formData, justification: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Items */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Requisition Items</CardTitle>
              <Button onClick={addItem} size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Item
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map((item, index) => (
                <div key={index}>
                  {index > 0 && <Separator />}
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-4 py-4">
                    <div className="md:col-span-2">
                      <Label>Item Name</Label>
                      <Input
                        value={item.item_name}
                        onChange={(e) => updateItem(index, 'item_name', e.target.value)}
                        placeholder="Enter item name"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <Label>Description</Label>
                      <Input
                        value={item.description}
                        onChange={(e) => updateItem(index, 'description', e.target.value)}
                        placeholder="Item description"
                      />
                    </div>

                    <div>
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                        min="0"
                        step="0.01"
                      />
                    </div>

                    <div className="flex items-end">
                      {items.length > 1 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeItem(index)}
                          className="gap-2"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div>
                      <Label>Unit of Measure</Label>
                      <Input
                        value={item.unit_of_measure}
                        onChange={(e) => updateItem(index, 'unit_of_measure', e.target.value)}
                        placeholder="pcs, kg, m"
                      />
                    </div>

                    <div>
                      <Label>Unit Price</Label>
                      <Input
                        type="number"
                        value={item.estimated_unit_price}
                        onChange={(e) => updateItem(index, 'estimated_unit_price', parseFloat(e.target.value) || 0)}
                        min="0"
                        step="0.01"
                      />
                    </div>

                    <div>
                      <Label>Total Price</Label>
                      <Input
                        type="number"
                        value={item.estimated_total_price}
                        readOnly
                        className="bg-muted"
                      />
                    </div>
                  </div>
                </div>
              ))}

              <div className="flex justify-end pt-4 border-t">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Total Estimated Amount</p>
                  <p className="text-lg font-semibold">
                    ${totalEstimatedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !formData.title.trim() || !formData.requiredDate}
          >
            {isLoading ? 'Creating...' : 'Create Purchase Requisition'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}