import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAssetRequests } from "@/hooks/useAssetRequests";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { AssetMasterSelector } from "@/components/common/AssetMasterSelector";
import { Card, CardContent } from "@/components/ui/card";

interface CreateAssetRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface RequestItem {
  id?: string;
  request_type: "from_master" | "new_item";
  asset_master_id?: string;
  item_name?: string;
  item_description?: string;
  brand?: string;
  specifications?: string;
  quantity_requested: number;
  unit_price_estimate?: number;
  total_price_estimate?: number;
  justification?: string;
  preferred_vendor?: string;
}

export const CreateAssetRequestDialog = ({ open, onOpenChange }: CreateAssetRequestDialogProps) => {
  const { toast } = useToast();
  const { createRequest, isCreating } = useAssetRequests();
  
  const [requesterName, setRequesterName] = useState("");
  const [department, setDepartment] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [requiredDate, setRequiredDate] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [purpose, setPurpose] = useState("");
  const [justification, setJustification] = useState("");
  const [items, setItems] = useState<RequestItem[]>([{
    request_type: "from_master",
    quantity_requested: 1
  }]);

  const handleAddItem = () => {
    setItems([...items, {
      request_type: "from_master",
      quantity_requested: 1
    }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof RequestItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Calculate total price if quantity or unit price changes
    if (field === "quantity_requested" || field === "unit_price_estimate") {
      const item = newItems[index];
      if (item.quantity_requested && item.unit_price_estimate) {
        item.total_price_estimate = item.quantity_requested * item.unit_price_estimate;
      }
    }
    
    setItems(newItems);
  };

  const handleSubmit = async (asDraft: boolean = false) => {
    if (!requesterName || !purpose || !requiredDate) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    if (items.length === 0 || items.some(item => !item.item_name || item.quantity_requested <= 0)) {
      toast({
        title: "Validation Error",
        description: "Please add at least one valid item",
        variant: "destructive"
      });
      return;
    }

    const request = {
      requester_name: requesterName,
      department,
      contact_number: contactNumber,
      required_date: requiredDate,
      priority,
      purpose,
      justification,
      status: asDraft ? "draft" as const : "pending_hod_approval" as const,
      request_date: new Date().toISOString().split('T')[0]
    };

    const itemsWithLineNumbers = items.map((item, index) => ({
      ...item,
      line_number: index + 1
    }));

    createRequest(
      { request, items: itemsWithLineNumbers },
      {
        onSuccess: () => {
          toast({
            title: "Success",
            description: asDraft ? "Request saved as draft" : "Request submitted for approval"
          });
          onOpenChange(false);
          // Reset form
          setRequesterName("");
          setDepartment("");
          setContactNumber("");
          setRequiredDate("");
          setPriority("medium");
          setPurpose("");
          setJustification("");
          setItems([{ request_type: "from_master", quantity_requested: 1 }]);
        }
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Asset Request</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Request Header */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="requesterName">Requester Name *</Label>
                  <Input
                    id="requesterName"
                    value={requesterName}
                    onChange={(e) => setRequesterName(e.target.value)}
                    placeholder="Enter requester name"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <Input
                    id="department"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="Enter department"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="contactNumber">Contact Number</Label>
                  <Input
                    id="contactNumber"
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    placeholder="Enter contact number"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="requiredDate">Required Date *</Label>
                  <Input
                    id="requiredDate"
                    type="date"
                    value={requiredDate}
                    onChange={(e) => setRequiredDate(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority *</Label>
                  <Select value={priority} onValueChange={(value: any) => setPriority(value)}>
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
              
              <div className="space-y-2">
                <Label htmlFor="purpose">Purpose *</Label>
                <Textarea
                  id="purpose"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="Enter purpose of request"
                  rows={2}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="justification">Justification</Label>
                <Textarea
                  id="justification"
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="Enter justification for request"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Request Items */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Request Items *</Label>
              <Button onClick={handleAddItem} size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </div>
            
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Type</TableHead>
                    <TableHead>Asset/Item</TableHead>
                    <TableHead className="w-[100px]">Quantity</TableHead>
                    <TableHead className="w-[120px]">Unit Price</TableHead>
                    <TableHead className="w-[120px]">Total</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Select
                          value={item.request_type}
                          onValueChange={(value: any) => handleItemChange(index, "request_type", value)}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="from_master">From Master</SelectItem>
                            <SelectItem value="new_item">New Item</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {item.request_type === "from_master" ? (
                          <AssetMasterSelector
                            value={item.asset_master_id}
                            onValueChange={(assetMasterId) => {
                              handleItemChange(index, "asset_master_id", assetMasterId);
                            }}
                            onAssetSelected={(assetMaster) => {
                              if (assetMaster) {
                                handleItemChange(index, "item_name", assetMaster.asset_name);
                                handleItemChange(index, "brand", assetMaster.brand);
                              }
                            }}
                          />
                        ) : (
                          <Input
                            placeholder="Enter item name"
                            value={item.item_name || ""}
                            onChange={(e) => handleItemChange(index, "item_name", e.target.value)}
                            className="h-8"
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity_requested}
                          onChange={(e) => handleItemChange(index, "quantity_requested", parseInt(e.target.value) || 1)}
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_price_estimate || ""}
                          onChange={(e) => handleItemChange(index, "unit_price_estimate", parseFloat(e.target.value) || 0)}
                          className="h-8"
                          placeholder="0.00"
                        />
                      </TableCell>
                      <TableCell>
                        {item.total_price_estimate?.toFixed(2) || "0.00"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveItem(index)}
                          disabled={items.length === 1}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="outline" onClick={() => handleSubmit(true)} disabled={isCreating}>
              Save as Draft
            </Button>
            <Button onClick={() => handleSubmit(false)} disabled={isCreating}>
              Submit for Approval
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};