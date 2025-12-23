import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Package, Trash2 } from "lucide-react";
import { usePickPack } from "@/hooks/usePickPack";
import { useCompany } from "@/contexts/CompanyContext";

interface FinishedGoodsIssueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  salesOrderId: string;
  salesOrderItems: any[];
}

export function FinishedGoodsIssueDialog({
  open,
  onOpenChange,
  salesOrderId,
  salesOrderItems
}: FinishedGoodsIssueDialogProps) {
  const { createFinishedGoodsIssue, isCreatingFinishedGoodsIssue, updateIssueStatus } = usePickPack();
  const { selectedCompany } = useCompany();

  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState("");
  const [issueItems, setIssueItems] = useState<any[]>([]);

  // Initialize issue items from sales order items with pending quantities
  useEffect(() => {
    if (open && salesOrderItems?.length) {
      const pendingItems = salesOrderItems
        .filter(item => item.quantity_ordered > item.quantity_issued)
        .map(item => {
          // Get available stock from finished goods (single source of truth)
          const availableStock = item.finished_goods?.available_stock || 0;
          
          // CPO remaining quantity (what still needs to be issued)
          const cpoRemaining = item.quantity_ordered - item.quantity_issued;
          
          return {
            sales_order_item_id: item.id,
            finished_good_id: item.finished_good_id,
            item_name: item.item_name,
            quantity_to_issue: Math.min(cpoRemaining, availableStock),
            max_quantity: cpoRemaining, // MAX is the CPO requirement
            available_stock: availableStock, // Available in finished goods
            batch_number: "",
            notes: ""
          };
        });
      setIssueItems(pendingItems);
    }
  }, [open, salesOrderItems]);

  const updateIssueItem = (index: number, field: string, value: any) => {
    const updated = [...issueItems];
    updated[index] = { ...updated[index], [field]: value };
    setIssueItems(updated);
  };

  const removeIssueItem = (index: number) => {
    setIssueItems(issueItems.filter((_, i) => i !== index));
  };

  const validateIssue = () => {
    if (issueItems.length === 0) {
      return { valid: false, message: "No items to issue" };
    }

    for (const item of issueItems) {
      if (!item.quantity_to_issue || item.quantity_to_issue <= 0) {
        return { valid: false, message: `Invalid quantity for ${item.item_name}` };
      }
      if (item.quantity_to_issue > item.available_stock) {
        return { valid: false, message: `Insufficient stock for ${item.item_name}. Available: ${item.available_stock}` };
      }
    }

    return { valid: true };
  };

  const handleSubmit = async (postImmediately: boolean = false) => {
    const validation = validateIssue();
    if (!validation.valid) {
      alert(validation.message);
      return;
    }

    createFinishedGoodsIssue(
      {
        issueData: {
          sales_order_id: salesOrderId,
          issue_date: issueDate,
          notes,
          company_id: selectedCompany?.id
        },
        items: issueItems,
        postImmediately
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
    setIssueDate(new Date().toISOString().split('T')[0]);
    setNotes("");
    setIssueItems([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Issue Finished Goods from Warehouse</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="issue-date">Issue Date</Label>
              <Input
                id="issue-date"
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>Items to Issue</Label>
            <div className="space-y-3 mt-2">
              {issueItems.map((item, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">{item.item_name}</div>
                      <div className="text-sm text-muted-foreground">
                        Available in Warehouse: {item.available_stock} | CPO Remaining: {item.max_quantity}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeIssueItem(index)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Quantity to Issue</Label>
                      <Input
                        type="number"
                        min="0"
                        max={item.available_stock}
                        value={item.quantity_to_issue}
                        onChange={(e) => updateIssueItem(index, 'quantity_to_issue', parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    <div>
                      <Label className="text-xs">Batch Number</Label>
                      <Input
                        value={item.batch_number}
                        onChange={(e) => updateIssueItem(index, 'batch_number', e.target.value)}
                        placeholder="Optional"
                      />
                    </div>
                  </div>

                  {item.quantity_to_issue > item.available_stock && (
                    <div className="flex items-center gap-2 text-sm text-destructive">
                      <AlertCircle className="w-4 h-4" />
                      <span>Quantity exceeds available stock</span>
                    </div>
                  )}
                </div>
              ))}

              {issueItems.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="w-12 h-12 mx-auto mb-2" />
                  <p>No pending items to issue</p>
                </div>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={() => handleSubmit(false)}
            disabled={isCreatingFinishedGoodsIssue || issueItems.length === 0}
          >
            Save as Draft
          </Button>
          <Button
            onClick={() => handleSubmit(true)}
            disabled={isCreatingFinishedGoodsIssue || issueItems.length === 0}
          >
            <Package className="w-4 h-4 mr-2" />
            Post Issue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
