import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateSupplier } from '@/hooks/useSuppliers';
import { Loader2 } from 'lucide-react';

interface QuickCreateSupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSupplierCreated: (supplierId: string) => void;
}

const SUPPLIER_TYPES = [
  { value: 'vendor', label: 'Vendor' },
  { value: 'service_provider', label: 'Service Provider' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'manufacturer', label: 'Manufacturer' },
];

export function QuickCreateSupplierDialog({ 
  open, 
  onOpenChange, 
  onSupplierCreated 
}: QuickCreateSupplierDialogProps) {
  const [name, setName] = useState('');
  const [supplierType, setSupplierType] = useState<string>('');
  
  const { mutateAsync: createSupplier, isPending } = useCreateSupplier();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !supplierType) return;

    try {
      const supplier = await createSupplier({
        name: name.trim(),
        supplier_type: supplierType as any,
        status: 'active',
      });
      
      onSupplierCreated(supplier.id);
      handleClose();
    } catch (error) {
      console.error('Error creating supplier:', error);
    }
  };

  const handleClose = () => {
    setName('');
    setSupplierType('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Quick Create Supplier</DialogTitle>
          <DialogDescription>
            Add a new supplier with basic information. You can add more details later in Supplier Master.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="supplier-name">Supplier Name *</Label>
            <Input
              id="supplier-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter supplier name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="supplier-type">Supplier Type *</Label>
            <Select value={supplierType} onValueChange={setSupplierType} required>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent className="bg-background border z-50">
                {SUPPLIER_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !name.trim() || !supplierType}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Supplier
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
