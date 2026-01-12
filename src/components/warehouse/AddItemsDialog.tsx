import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WarehouseItem } from '@/types/itemBin';
import { SingleItemForm } from './SingleItemForm';
import { BulkItemImportContent } from './BulkItemImportContent';
import { Package, Upload } from 'lucide-react';

interface AddItemsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingItem?: WarehouseItem | null;
}

export function AddItemsDialog({ open, onOpenChange, editingItem }: AddItemsDialogProps) {
  const [activeTab, setActiveTab] = useState<string>('single');

  // Force single tab when editing and reset tab on close
  useEffect(() => {
    if (editingItem) {
      setActiveTab('single');
    }
  }, [editingItem]);

  useEffect(() => {
    if (!open) {
      // Reset to single tab when dialog closes
      setActiveTab('single');
    }
  }, [open]);

  const handleSuccess = () => {
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {editingItem ? 'Edit Item' : 'Add Items'}
          </DialogTitle>
          <DialogDescription>
            {editingItem 
              ? 'Update the item details below.' 
              : 'Add a single item or import multiple items from a CSV file.'
            }
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="single" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Single Item
            </TabsTrigger>
            <TabsTrigger 
              value="bulk" 
              disabled={!!editingItem}
              className="flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              Bulk Import
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-4">
            <TabsContent value="single" className="m-0 h-full">
              <SingleItemForm 
                editingItem={editingItem}
                onSuccess={handleSuccess}
                onCancel={handleCancel}
              />
            </TabsContent>

            <TabsContent value="bulk" className="m-0 h-full">
              <BulkItemImportContent
                onSuccess={handleSuccess}
                onCancel={handleCancel}
              />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
