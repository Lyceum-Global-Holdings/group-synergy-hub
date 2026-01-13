import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface MissingOpeningStockItem {
  id: string;
  item_code: string;
  name: string;
  current_stock: number;
  company_id: string | null;
}

interface FixMissingOpeningStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FixMissingOpeningStockDialog({
  open,
  onOpenChange,
}: FixMissingOpeningStockDialogProps) {
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);

  // Query items missing opening stock transactions
  const { data: missingItems = [], isLoading, refetch } = useQuery({
    queryKey: ['missing-opening-stock', selectedCompany?.id],
    queryFn: async () => {
      // First get items with stock
      const { data: items, error: itemsError } = await supabase
        .from('warehouse_items')
        .select('id, item_code, name, current_stock, company_id')
        .gt('current_stock', 0)
        .eq('company_id', selectedCompany?.id || '');

      if (itemsError) throw itemsError;
      if (!items || items.length === 0) return [];

      // Get items that have opening_stock transactions
      const { data: existingTransactions, error: txError } = await supabase
        .from('stock_transactions')
        .select('item_id')
        .eq('transaction_type', 'opening_stock')
        .in('item_id', items.map(i => i.id));

      if (txError) throw txError;

      const itemsWithOpeningStock = new Set(existingTransactions?.map(t => t.item_id) || []);

      // Filter to only items without opening stock
      return items.filter(item => !itemsWithOpeningStock.has(item.id)) as MissingOpeningStockItem[];
    },
    enabled: open && !!selectedCompany?.id,
  });

  const handleSelectAll = () => {
    if (selectedItems.size === missingItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(missingItems.map(item => item.id)));
    }
  };

  const handleToggleItem = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const handleCreateOpeningStock = async () => {
    if (selectedItems.size === 0) {
      toast({
        title: "No items selected",
        description: "Please select at least one item to create opening stock transactions.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('You must be logged in to perform this action');
      }

      const itemsToProcess = missingItems.filter(item => selectedItems.has(item.id));
      
      const stockTransactions = itemsToProcess.map(item => ({
        item_id: item.id,
        transaction_type: 'opening_stock' as const,
        reference_type: 'manual' as const,
        quantity_change: item.current_stock,
        quantity_before: 0,
        quantity_after: item.current_stock,
        notes: 'Opening stock balance (retroactive fix)',
        company_id: item.company_id,
        created_by: user.id,
      }));

      const { error } = await supabase
        .from('stock_transactions')
        .insert(stockTransactions);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Created opening stock transactions for ${stockTransactions.length} item(s).`,
      });

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['stock-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['missing-opening-stock'] });
      
      setSelectedItems(new Set());
      refetch();
    } catch (error: any) {
      console.error('Error creating opening stock transactions:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create opening stock transactions",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const allSelected = missingItems.length > 0 && selectedItems.size === missingItems.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Fix Missing Opening Stock Transactions
          </DialogTitle>
          <DialogDescription>
            These items have stock but no opening stock transaction recorded. Select items to retroactively create opening stock entries.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>Scanning for items...</span>
          </div>
        ) : missingItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mb-3" />
            <p className="font-medium">All items are up to date!</p>
            <p className="text-sm text-muted-foreground">
              No items are missing opening stock transactions.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b pb-2 mb-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={handleSelectAll}
                  id="select-all"
                />
                <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                  Select All ({missingItems.length} items)
                </label>
              </div>
              <Badge variant="secondary">
                {selectedItems.size} selected
              </Badge>
            </div>

            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-2">
                {missingItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={selectedItems.has(item.id)}
                        onCheckedChange={() => handleToggleItem(item.id)}
                        id={item.id}
                      />
                      <div>
                        <p className="font-medium">{item.item_code}</p>
                        <p className="text-sm text-muted-foreground">{item.name}</p>
                      </div>
                    </div>
                    <Badge variant="outline">
                      Stock: {item.current_stock}
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {missingItems.length > 0 && (
            <Button 
              onClick={handleCreateOpeningStock} 
              disabled={isProcessing || selectedItems.size === 0}
            >
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Opening Stock ({selectedItems.size})
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
