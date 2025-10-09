import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';

interface GrnListForPoProps {
  poId: string;
}

export function GrnListForPo({ poId }: GrnListForPoProps) {
  const { data: grns = [], isLoading } = useQuery({
    queryKey: ['grns-for-po', poId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('goods_receipt_notes')
        .select('*')
        .eq('po_id', poId)
        .order('grn_date', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!poId
  });

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading GRNs...</div>;
  }

  if (grns.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No GRNs created for this PO yet. Click "Create GRN" to record goods receipt.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>GRN Number</TableHead>
          <TableHead>GRN Date</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Total Value</TableHead>
          <TableHead>Invoice Number</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {grns.map((grn) => (
          <TableRow key={grn.id}>
            <TableCell className="font-medium">{grn.grn_number}</TableCell>
            <TableCell>{format(new Date(grn.grn_date), 'MMM dd, yyyy')}</TableCell>
            <TableCell>
              <Badge variant={grn.status === 'approved' ? 'default' : 'secondary'}>
                {grn.status}
              </Badge>
            </TableCell>
            <TableCell>Rs. {grn.total_value?.toLocaleString() || '0'}</TableCell>
            <TableCell>{grn.invoice_number || '-'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
