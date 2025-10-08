import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { useFinishedGoodsMovements } from '@/hooks/useFinishedGoodsMovements';
import { FinishedGoodsStockAdjustmentDialog } from './FinishedGoodsStockAdjustmentDialog';
import { Loader2, Plus } from 'lucide-react';

interface FinishedGoodsMovementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  finishedGoodId: string;
  productName: string;
  currentStock?: number;
}

const movementTypeLabels = {
  adjustment: 'Stock Adjustment',
  production_receipt: 'Production Receipt',
  sales_issue: 'Sales Issue',
  transfer_in: 'Transfer In',
  transfer_out: 'Transfer Out',
  return: 'Return',
};

const getMovementTypeColor = (type: string) => {
  switch (type) {
    case 'production_receipt':
    case 'transfer_in':
    case 'return':
      return 'bg-green-100 text-green-800';
    case 'sales_issue':
    case 'transfer_out':
      return 'bg-red-100 text-red-800';
    case 'adjustment':
      return 'bg-yellow-100 text-yellow-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export function FinishedGoodsMovementDialog({ 
  open, 
  onOpenChange, 
  finishedGoodId, 
  productName, 
  currentStock 
}: FinishedGoodsMovementDialogProps) {
  const { movements, isLoading } = useFinishedGoodsMovements(finishedGoodId);
  const [isAdjustmentDialogOpen, setIsAdjustmentDialogOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            Stock Movement History - {productName}
            <Button
              onClick={() => setIsAdjustmentDialogOpen(true)}
              size="sm"
              className="ml-4"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Adjustment
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">Loading stock movements...</span>
            </div>
          ) : movements.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No stock movements found for this product.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Qty Change</TableHead>
                  <TableHead className="text-right">Qty Before</TableHead>
                  <TableHead className="text-right">Qty After</TableHead>
                  <TableHead className="text-right">Unit Cost</TableHead>
                  <TableHead className="text-right">Total Value</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((movement) => (
                  <TableRow key={movement.id}>
                    <TableCell>
                      {format(new Date(movement.created_at), 'MMM dd, yyyy HH:mm')}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="secondary" 
                        className={getMovementTypeColor(movement.movement_type)}
                      >
                        {movementTypeLabels[movement.movement_type] || movement.movement_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {movement.reference_number || movement.reference_id || '-'}
                    </TableCell>
                    <TableCell className={`text-right font-medium ${
                      movement.quantity_change > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {movement.quantity_change > 0 ? '+' : ''}{movement.quantity_change}
                    </TableCell>
                    <TableCell className="text-right">
                      {movement.quantity_before}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {movement.quantity_after}
                    </TableCell>
                    <TableCell className="text-right">
                      {movement.unit_cost ? `LKR ${movement.unit_cost.toFixed(2)}` : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {movement.total_value ? `LKR ${movement.total_value.toFixed(2)}` : '-'}
                    </TableCell>
                    <TableCell>
                      {movement.notes || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <FinishedGoodsStockAdjustmentDialog
          open={isAdjustmentDialogOpen}
          onOpenChange={setIsAdjustmentDialogOpen}
          finishedGoodId={finishedGoodId}
          productName={productName}
          currentStock={currentStock || movements[0]?.quantity_after || 0}
        />
      </DialogContent>
    </Dialog>
  );
}