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
import { History, Loader2, ArrowUpCircle, RotateCcw, Settings2 } from 'lucide-react';
import { FloorRoomMaterial } from '@/types/construction';
import {
  useRoomMaterialTransactions,
  useCreateMaterialTransaction,
  MaterialTransactionType,
} from '@/hooks/construction/useRoomMaterialTransactions';
import { format } from 'date-fns';

interface MaterialTransactionsDialogProps {
  material: FloorRoomMaterial | null;
  roomId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TRANSACTION_CONFIG: Record<MaterialTransactionType, { label: string; icon: React.ElementType; color: string }> = {
  issue: { label: 'Issue', icon: ArrowUpCircle, color: 'text-green-600' },
  return: { label: 'Return', icon: RotateCcw, color: 'text-orange-600' },
  adjustment: { label: 'Adjustment', icon: Settings2, color: 'text-purple-600' },
};

export function MaterialTransactionsDialog({
  material,
  roomId,
  open,
  onOpenChange,
}: MaterialTransactionsDialogProps) {
  const [showAdjustForm, setShowAdjustForm] = useState(false);
  const [adjustQuantity, setAdjustQuantity] = useState<string>('');
  const [adjustNotes, setAdjustNotes] = useState<string>('');

  const { data: transactions = [], isLoading } = useRoomMaterialTransactions(material?.id || null);
  const createTransaction = useCreateMaterialTransaction();

  const handleAdjust = () => {
    if (!material) return;

    createTransaction.mutate(
      {
        room_material_id: material.id,
        room_id: roomId,
        transaction_type: 'adjustment',
        quantity: parseFloat(adjustQuantity) || 0,
        notes: adjustNotes || undefined,
      },
      {
        onSuccess: () => {
          setShowAdjustForm(false);
          setAdjustQuantity('');
          setAdjustNotes('');
        },
      }
    );
  };

  const getTransactionIcon = (type: MaterialTransactionType) => {
    const config = TRANSACTION_CONFIG[type];
    if (!config) return null;
    const Icon = config.icon;
    return <Icon className={`h-4 w-4 ${config.color}`} />;
  };

  const getTransactionBadgeVariant = (type: MaterialTransactionType): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (type) {
      case 'issue':
        return 'default';
      case 'return':
        return 'outline';
      case 'adjustment':
        return 'secondary';
      default:
        return 'default';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Transaction History
          </DialogTitle>
          {material && (
            <div className="text-sm text-muted-foreground mt-1">
              {material.warehouse_item?.item_code} - {material.warehouse_item?.name}
            </div>
          )}
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Status */}
          {material && (
            <div className="grid grid-cols-3 gap-4 p-3 bg-muted/30 rounded-lg text-sm">
              <div>
                <span className="text-muted-foreground">Required:</span>{' '}
                <span className="font-medium">{material.quantity_required}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Issued:</span>{' '}
                <span className="font-medium text-primary">{material.quantity_allocated || 0}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Used:</span>{' '}
                <span className="font-medium">{material.quantity_used || 0}</span>
              </div>
            </div>
          )}

          {/* Adjust Quantity Form */}
          {!showAdjustForm ? (
            <Button 
              onClick={() => setShowAdjustForm(true)} 
              size="sm" 
              variant="outline"
              className="w-full"
            >
              <Settings2 className="h-4 w-4 mr-2" />
              Manual Adjustment
            </Button>
          ) : (
            <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
              <div className="space-y-2">
                <Label>New Allocated Quantity</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.001"
                  value={adjustQuantity}
                  onChange={(e) => setAdjustQuantity(e.target.value)}
                  placeholder="Enter new quantity"
                />
                <p className="text-xs text-muted-foreground">
                  This will set the allocated quantity to this exact value (does not affect warehouse stock)
                </p>
              </div>

              <div className="space-y-2">
                <Label>Notes (Optional)</Label>
                <Input
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  placeholder="Reason for adjustment..."
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowAdjustForm(false);
                    setAdjustQuantity('');
                    setAdjustNotes('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleAdjust}
                  disabled={!adjustQuantity || createTransaction.isPending}
                >
                  {createTransaction.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Apply Adjustment
                </Button>
              </div>
            </div>
          )}

          {/* Transaction History */}
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Transaction History</h4>
            <ScrollArea className="h-[280px]">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No transactions recorded yet
                </div>
              ) : (
                <div className="space-y-2">
                  {transactions.map((transaction) => {
                    const config = TRANSACTION_CONFIG[transaction.transaction_type as MaterialTransactionType];
                    return (
                      <div
                        key={transaction.id}
                        className="border rounded-lg p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getTransactionIcon(transaction.transaction_type as MaterialTransactionType)}
                            <Badge variant={getTransactionBadgeVariant(transaction.transaction_type as MaterialTransactionType)}>
                              {config?.label || transaction.transaction_type}
                            </Badge>
                            {transaction.total_value && (
                              <span className="text-xs text-muted-foreground">
                                ${transaction.total_value.toLocaleString()}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(transaction.created_at), 'MMM d, yyyy HH:mm')}
                          </span>
                        </div>
                        <div className="text-sm flex flex-wrap gap-x-4 gap-y-1">
                          <div>
                            <span className="text-muted-foreground">Qty:</span>{' '}
                            <span className="font-medium">{transaction.quantity}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Room:</span>{' '}
                            <span>{transaction.previous_quantity}</span>
                            <span className="text-muted-foreground mx-1">→</span>
                            <span className="font-medium">{transaction.new_quantity}</span>
                          </div>
                          {transaction.previous_warehouse_stock !== null && (
                            <div>
                              <span className="text-muted-foreground">Warehouse:</span>{' '}
                              <span>{transaction.previous_warehouse_stock}</span>
                              <span className="text-muted-foreground mx-1">→</span>
                              <span className="font-medium">{transaction.new_warehouse_stock}</span>
                            </div>
                          )}
                        </div>
                        {transaction.notes && (
                          <p className="text-xs text-muted-foreground">{transaction.notes}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
