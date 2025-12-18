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
import { Plus, History, Loader2, ArrowUpCircle, ArrowDownCircle, RotateCcw, Settings2 } from 'lucide-react';
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

const TRANSACTION_TYPES: { value: MaterialTransactionType; label: string; icon: React.ElementType; color: string }[] = [
  { value: 'allocation', label: 'Allocate', icon: ArrowUpCircle, color: 'text-green-600' },
  { value: 'usage', label: 'Record Usage', icon: ArrowDownCircle, color: 'text-blue-600' },
  { value: 'return', label: 'Return', icon: RotateCcw, color: 'text-orange-600' },
  { value: 'adjustment', label: 'Adjust', icon: Settings2, color: 'text-purple-600' },
];

export function MaterialTransactionsDialog({
  material,
  roomId,
  open,
  onOpenChange,
}: MaterialTransactionsDialogProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [transactionType, setTransactionType] = useState<MaterialTransactionType>('allocation');
  const [quantity, setQuantity] = useState<string>('1');
  const [notes, setNotes] = useState<string>('');

  const { data: transactions = [], isLoading } = useRoomMaterialTransactions(material?.id || null);
  const createTransaction = useCreateMaterialTransaction();

  const handleAddTransaction = () => {
    if (!material) return;

    createTransaction.mutate(
      {
        room_material_id: material.id,
        room_id: roomId,
        transaction_type: transactionType,
        quantity: parseFloat(quantity) || 0,
        notes: notes || undefined,
      },
      {
        onSuccess: () => {
          setShowAddForm(false);
          setTransactionType('allocation');
          setQuantity('1');
          setNotes('');
        },
      }
    );
  };

  const getTransactionIcon = (type: MaterialTransactionType) => {
    const config = TRANSACTION_TYPES.find((t) => t.value === type);
    if (!config) return null;
    const Icon = config.icon;
    return <Icon className={`h-4 w-4 ${config.color}`} />;
  };

  const getTransactionBadgeVariant = (type: MaterialTransactionType): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (type) {
      case 'allocation':
        return 'default';
      case 'usage':
        return 'secondary';
      case 'return':
        return 'outline';
      case 'adjustment':
        return 'destructive';
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
            Material Transactions
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
                <span className="text-muted-foreground">Allocated:</span>{' '}
                <span className="font-medium">{material.quantity_allocated || 0}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Used:</span>{' '}
                <span className="font-medium">{material.quantity_used || 0}</span>
              </div>
            </div>
          )}

          {/* Add Transaction Button/Form */}
          {!showAddForm ? (
            <Button onClick={() => setShowAddForm(true)} size="sm" className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Record Transaction
            </Button>
          ) : (
            <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
              <div className="space-y-2">
                <Label>Transaction Type</Label>
                <Select
                  value={transactionType}
                  onValueChange={(value) => setTransactionType(value as MaterialTransactionType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRANSACTION_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <type.icon className={`h-4 w-4 ${type.color}`} />
                          {type.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>
                  {transactionType === 'adjustment' ? 'New Quantity' : 'Quantity'}
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="0.001"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
                {transactionType === 'adjustment' && (
                  <p className="text-xs text-muted-foreground">
                    This will set the allocated quantity to this exact value
                  </p>
                )}
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
                    setTransactionType('allocation');
                    setQuantity('1');
                    setNotes('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleAddTransaction}
                  disabled={!quantity || parseFloat(quantity) <= 0 || createTransaction.isPending}
                >
                  {createTransaction.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Record
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
                  {transactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="border rounded-lg p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getTransactionIcon(transaction.transaction_type as MaterialTransactionType)}
                          <Badge variant={getTransactionBadgeVariant(transaction.transaction_type as MaterialTransactionType)}>
                            {transaction.transaction_type}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(transaction.created_at), 'MMM d, yyyy HH:mm')}
                        </span>
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">Qty:</span>{' '}
                        <span className="font-medium">{transaction.quantity}</span>
                        <span className="text-muted-foreground mx-2">|</span>
                        <span className="text-muted-foreground">{transaction.previous_quantity}</span>
                        <span className="text-muted-foreground mx-1">→</span>
                        <span className="font-medium">{transaction.new_quantity}</span>
                      </div>
                      {transaction.notes && (
                        <p className="text-xs text-muted-foreground">{transaction.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
