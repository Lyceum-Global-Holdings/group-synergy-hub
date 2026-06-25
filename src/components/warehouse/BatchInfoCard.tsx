import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, Calendar, AlertTriangle } from 'lucide-react';
import { ItemBatch } from '@/types/batch';
import { format, differenceInDays, parseISO } from 'date-fns';
import { formatCurrency } from '@/lib/utils';

interface BatchInfoCardProps {
  batch: ItemBatch;
  showActions?: boolean;
}

export function BatchInfoCard({ batch, showActions = false }: BatchInfoCardProps) {
  const getStatusBadge = () => {
    switch (batch.status) {
      case 'active':
        return <Badge variant="default" className="bg-green-600">Active</Badge>;
      case 'depleted':
        return <Badge variant="secondary">Depleted</Badge>;
      case 'expired':
        return <Badge variant="destructive">Expired</Badge>;
      case 'quarantine':
        return <Badge variant="destructive" className="bg-amber-600">Quarantine</Badge>;
      default:
        return <Badge variant="secondary">{batch.status}</Badge>;
    }
  };

  const getExpiryStatus = () => {
    if (!batch.expiry_date) return null;
    const daysUntilExpiry = differenceInDays(parseISO(batch.expiry_date), new Date());

    if (daysUntilExpiry < 0) {
      return { text: 'Expired', variant: 'destructive' as const };
    }
    if (daysUntilExpiry <= 30) {
      return { text: `Expires in ${daysUntilExpiry} days`, variant: 'warning' as const };
    }
    if (daysUntilExpiry <= 90) {
      return { text: `Expires in ${daysUntilExpiry} days`, variant: 'secondary' as const };
    }
    return null;
  };

  const expiryStatus = getExpiryStatus();

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" />
            {batch.batch_number}
          </CardTitle>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">Received:</span>{' '}
            <span className="font-medium">{batch.quantity_received}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Remaining:</span>{' '}
            <span className="font-medium text-primary">{batch.quantity_remaining}</span>
          </div>
          {batch.manufacturing_date && (
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Mfg:</span>{' '}
              <span className="font-medium">
                {format(parseISO(batch.manufacturing_date), 'dd MMM yyyy')}
              </span>
            </div>
          )}
          {batch.expiry_date && (
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Exp:</span>{' '}
              <span className="font-medium">
                {format(parseISO(batch.expiry_date), 'dd MMM yyyy')}
              </span>
            </div>
          )}
        </div>

        {expiryStatus && (
          <div className="flex items-center gap-2 mt-2">
            <AlertTriangle className={`h-4 w-4 ${
              expiryStatus.variant === 'destructive' ? 'text-destructive' : 'text-amber-500'
            }`} />
            <Badge variant={expiryStatus.variant === 'destructive' ? 'destructive' : 'secondary'} className={
              expiryStatus.variant === 'warning' ? 'bg-amber-100 text-amber-800' : ''
            }>
              {expiryStatus.text}
            </Badge>
          </div>
        )}

        {batch.unit_cost > 0 && (
          <div className="text-sm pt-2 border-t">
            <span className="text-muted-foreground">Unit Cost:</span>{' '}
            <span className="font-medium">{formatCurrency(batch.unit_cost)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
