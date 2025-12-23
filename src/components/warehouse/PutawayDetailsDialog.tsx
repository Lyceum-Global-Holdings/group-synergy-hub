import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePutawayItems, useCompletePutaway, useUpdatePutaway } from '@/hooks/usePutaway';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface PutawayDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  putawayId: string;
}

export function PutawayDetailsDialog({
  open,
  onOpenChange,
  putawayId,
}: PutawayDetailsDialogProps) {
  const { data: items = [], isLoading: itemsLoading } = usePutawayItems(putawayId);
  const completePutaway = useCompletePutaway();
  const updatePutaway = useUpdatePutaway();

  const { data: putaway } = useQuery({
    queryKey: ['putaway-record', putawayId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('putaway_records')
        .select('*')
        .eq('id', putawayId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!putawayId && open
  });

  const handleComplete = async () => {
    await completePutaway.mutateAsync(putawayId);
    onOpenChange(false);
  };

  const handleCancel = async () => {
    await updatePutaway.mutateAsync({
      id: putawayId,
      updates: { status: 'cancelled' }
    });
    onOpenChange(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500';
      case 'completed':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  if (!putaway) return null;

  const canComplete = putaway.status === 'pending' || putaway.status === 'in_progress';
  const canCancel = putaway.status === 'pending' || putaway.status === 'in_progress';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Putaway Details - {putaway.putaway_number}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header Information */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge className={getStatusColor(putaway.status)}>
                {putaway.status.replace('_', ' ')}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Putaway Date</p>
              <p className="font-medium">
                {format(new Date(putaway.putaway_date), 'dd/MM/yyyy')}
              </p>
            </div>
            {putaway.grn_number && (
              <div>
                <p className="text-sm text-muted-foreground">GRN Reference</p>
                <p className="font-medium">{putaway.grn_number}</p>
              </div>
            )}
            {putaway.completed_date && (
              <div>
                <p className="text-sm text-muted-foreground">Completed Date</p>
                <p className="font-medium">
                  {format(new Date(putaway.completed_date), 'dd/MM/yyyy HH:mm')}
                </p>
              </div>
            )}
            {putaway.notes && (
              <div className="col-span-2">
                <p className="text-sm text-muted-foreground">Notes</p>
                <p className="font-medium">{putaway.notes}</p>
              </div>
            )}
          </div>

          <Separator />

          {/* Items Table */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Putaway Items</h3>
            {itemsLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading items...</div>
            ) : items.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No items found</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Seq</TableHead>
                    <TableHead>Item Name</TableHead>
                    <TableHead>Item Code</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Destination Bin</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.putaway_sequence || '-'}</TableCell>
                      <TableCell className="font-medium">{item.item_name}</TableCell>
                      <TableCell>{item.item_code || '-'}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{item.unit_of_measure}</TableCell>
                      <TableCell>{item.to_bin_id || '-'}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(item.status)}>
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{item.notes || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            {canCancel && (
              <Button
                variant="destructive"
                onClick={handleCancel}
                disabled={updatePutaway.isPending}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Cancel Putaway
              </Button>
            )}
            {canComplete && (
              <Button
                onClick={handleComplete}
                disabled={completePutaway.isPending}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Complete Putaway
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
