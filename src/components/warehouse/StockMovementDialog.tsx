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
import { useStockTransactions } from '@/hooks/useStockTransactions';
import { StockAdjustmentDialog } from './StockAdjustmentDialog';
import { Loader2, Plus } from 'lucide-react';

interface StockMovementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
  itemName: string;
  currentStock?: number;
}

const transactionTypeLabels: Record<string, string> = {
  opening_stock: 'Opening Stock',
  goods_receipt: 'Goods Receipt',
  material_issue: 'Material Issue',
  material_return: 'Material Return',
  adjustment: 'Stock Adjustment',
  transfer_in: 'Transfer In',
  transfer_out: 'Transfer Out',
  project_issue: 'Project Issue',
  project_return: 'Project Return',
};

const getTransactionTypeColor = (type: string) => {
  switch (type) {
    case 'opening_stock':
      return 'bg-blue-100 text-blue-800';
    case 'goods_receipt':
    case 'transfer_in':
    case 'project_return':
      return 'bg-green-100 text-green-800';
    case 'material_issue':
    case 'material_return':
    case 'transfer_out':
    case 'project_issue':
      return 'bg-red-100 text-red-800';
    case 'adjustment':
      return 'bg-yellow-100 text-yellow-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export function StockMovementDialog({ open, onOpenChange, itemId, itemName, currentStock }: StockMovementDialogProps) {
  const { transactions, isLoading } = useStockTransactions(itemId);
  const [isAdjustmentDialogOpen, setIsAdjustmentDialogOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            Stock Movement History - {itemName}
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
          ) : transactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No stock movements found for this item.
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
                {transactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell>
                      {format(new Date(transaction.created_at), 'MMM dd, yyyy HH:mm')}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="secondary" 
                        className={getTransactionTypeColor(transaction.transaction_type)}
                      >
                        {transactionTypeLabels[transaction.transaction_type]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {transaction.reference_id || '-'}
                    </TableCell>
                    <TableCell className={`text-right font-medium ${
                      transaction.quantity_change > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {transaction.quantity_change > 0 ? '+' : ''}{transaction.quantity_change}
                    </TableCell>
                    <TableCell className="text-right">
                      {transaction.quantity_before}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {transaction.quantity_after}
                    </TableCell>
                    <TableCell className="text-right">
                      {transaction.unit_cost ? `LKR ${transaction.unit_cost.toFixed(2)}` : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {transaction.total_value ? `LKR ${transaction.total_value.toFixed(2)}` : '-'}
                    </TableCell>
                    <TableCell>
                      {transaction.notes || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <StockAdjustmentDialog
          open={isAdjustmentDialogOpen}
          onOpenChange={setIsAdjustmentDialogOpen}
          itemId={itemId}
          itemName={itemName}
          currentStock={currentStock || transactions[0]?.quantity_after || 0}
        />
      </DialogContent>
    </Dialog>
  );
}