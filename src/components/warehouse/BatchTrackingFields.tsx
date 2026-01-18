import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Package } from 'lucide-react';

interface BatchTrackingFieldsProps {
  batchNumber: string;
  manufacturingDate: string;
  expiryDate: string;
  onBatchNumberChange: (value: string) => void;
  onManufacturingDateChange: (value: string) => void;
  onExpiryDateChange: (value: string) => void;
  disabled?: boolean;
  compact?: boolean;
}

export function BatchTrackingFields({
  batchNumber,
  manufacturingDate,
  expiryDate,
  onBatchNumberChange,
  onManufacturingDateChange,
  onExpiryDateChange,
  disabled = false,
  compact = false,
}: BatchTrackingFieldsProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Input
          type="text"
          value={batchNumber}
          onChange={(e) => onBatchNumberChange(e.target.value)}
          placeholder="Batch #"
          className="w-28"
          disabled={disabled}
        />
        <Input
          type="date"
          value={manufacturingDate}
          onChange={(e) => onManufacturingDateChange(e.target.value)}
          className="w-32"
          disabled={disabled}
          title="Manufacturing Date"
        />
        <Input
          type="date"
          value={expiryDate}
          onChange={(e) => onExpiryDateChange(e.target.value)}
          className="w-32"
          disabled={disabled}
          title="Expiry Date"
        />
      </div>
    );
  }

  return (
    <div className="space-y-3 p-3 border rounded-lg bg-muted/20">
      <div className="flex items-center gap-2">
        <Package className="h-4 w-4 text-primary" />
        <Label className="font-medium">Batch Tracking</Label>
        <Badge variant="outline" className="text-xs">Required</Badge>
      </div>
      
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Batch Number</Label>
          <Input
            type="text"
            value={batchNumber}
            onChange={(e) => onBatchNumberChange(e.target.value)}
            placeholder="Enter or auto-generate"
            disabled={disabled}
          />
        </div>
        
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Manufacturing Date</Label>
          <Input
            type="date"
            value={manufacturingDate}
            onChange={(e) => onManufacturingDateChange(e.target.value)}
            disabled={disabled}
          />
        </div>
        
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Expiry Date</Label>
          <Input
            type="date"
            value={expiryDate}
            onChange={(e) => onExpiryDateChange(e.target.value)}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}
