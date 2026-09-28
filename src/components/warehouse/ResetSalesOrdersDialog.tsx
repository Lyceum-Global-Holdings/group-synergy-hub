import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ResetSalesOrdersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isResetting: boolean;
  counts: {
    salesOrders: number;
    salesOrderItems: number;
    finishedGoodsIssues: number;
    pickLists: number;
    deliveryOrders: number;
  };
}

export function ResetSalesOrdersDialog({
  open,
  onOpenChange,
  onConfirm,
  isResetting,
  counts,
}: ResetSalesOrdersDialogProps) {
  const [confirmText, setConfirmText] = useState("");
  const [understood, setUnderstood] = useState(false);

  const isValid = confirmText === "RESET" && understood;

  const handleConfirm = () => {
    if (isValid) {
      onConfirm();
      setConfirmText("");
      setUnderstood(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
    setConfirmText("");
    setUnderstood(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Reset Sales Orders Module
          </DialogTitle>
          <DialogDescription>
            This action cannot be undone. It permanently deletes the selected company's sales order, picking, packing and
            delivery records, and gives back finished-goods stock taken by posted issues. Other companies are not affected.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert variant="destructive">
            <AlertDescription>
              <div className="font-semibold mb-2">The following data will be permanently deleted:</div>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>{counts.salesOrders} Sales Orders</li>
                <li>{counts.salesOrderItems} Sales Order Items</li>
                <li>{counts.finishedGoodsIssues} Finished Goods Issues</li>
                <li>{counts.pickLists} Pick Lists</li>
                <li>{counts.deliveryOrders} Delivery Orders</li>
              </ul>
            </AlertDescription>
          </Alert>

          <Alert>
            <AlertDescription>
              <div className="font-semibold mb-2">Stock will be restored:</div>
              <p className="text-sm">Finished goods stock quantities that were deducted during issues will be added back automatically.</p>
            </AlertDescription>
          </Alert>

          <Alert>
            <AlertDescription>
              <div className="font-semibold mb-2">Data that will NOT be affected:</div>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Customer Purchase Orders (CPOs)</li>
                <li>Customer Master Data</li>
                <li>Finished Goods Inventory</li>
                <li>Warehouse Items</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="understand" 
                checked={understood}
                onCheckedChange={(checked) => setUnderstood(checked as boolean)}
              />
              <Label htmlFor="understand" className="text-sm cursor-pointer">
                I understand this action cannot be undone
              </Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm">Type <span className="font-mono font-bold">RESET</span> to confirm</Label>
              <Input
                id="confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type RESET here"
                className="font-mono"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isResetting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isValid || isResetting}
          >
            {isResetting ? "Resetting..." : "Reset Module"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
