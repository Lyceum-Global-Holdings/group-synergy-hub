import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Archive, Trash2 } from 'lucide-react';
import { useItemReferences } from '@/hooks/useItemReferences';
import { WarehouseItem, CatalogItem } from '@/types/itemBin';

interface DeleteItemConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: WarehouseItem | CatalogItem | null;
  onConfirmDelete: (itemId: string, forceDelete: boolean) => void;
  onMarkInactive: (itemId: string) => void;
  isLoading: boolean;
}

export function DeleteItemConfirmationDialog({
  open,
  onOpenChange,
  item,
  onConfirmDelete,
  onMarkInactive,
  isLoading
}: DeleteItemConfirmationDialogProps) {
  const [showForceDelete, setShowForceDelete] = useState(false);
  
  const { data: references = [], isLoading: isCheckingReferences } = useItemReferences(item?.id || '');

  const hasReferences = references.length > 0;

  const handleMarkInactive = () => {
    if (item) {
      onMarkInactive(item.id);
      onOpenChange(false);
    }
  };

  const handleForceDelete = () => {
    if (item) {
      onConfirmDelete(item.id, true);
      onOpenChange(false);
      setShowForceDelete(false);
    }
  };

  const handleSafeDelete = () => {
    if (item) {
      onConfirmDelete(item.id, false);
      onOpenChange(false);
    }
  };

  if (!item) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Delete Item Confirmation
          </AlertDialogTitle>
          <AlertDialogDescription>
            You are about to delete <strong>{item.name}</strong> ({item.item_code}).
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          {isCheckingReferences ? (
            <div className="text-sm text-muted-foreground">Checking for references...</div>
          ) : hasReferences ? (
            <div className="space-y-3">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  This item is referenced in other records and cannot be safely deleted.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <div className="text-sm font-medium">Referenced in:</div>
                <div className="space-y-1">
                  {references.map((ref) => (
                    <div key={ref.table} className="flex items-center justify-between text-sm">
                      <span>{ref.description}</span>
                      <Badge variant="secondary">{ref.count} record{ref.count !== 1 ? 's' : ''}</Badge>
                    </div>
                  ))}
                </div>
              </div>

              <Alert>
                <AlertDescription>
                  <strong>Recommended:</strong> Mark as inactive instead of deleting to preserve data integrity.
                </AlertDescription>
              </Alert>
            </div>
          ) : (
            <Alert>
              <AlertDescription>
                This item has no references and can be safely deleted.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <AlertDialogFooter className="flex-col gap-2">
          {hasReferences && (
            <div className="flex gap-2 w-full">
              <Button
                variant="outline"
                onClick={handleMarkInactive}
                disabled={isLoading}
                className="flex-1"
              >
                <Archive className="mr-2 h-4 w-4" />
                Mark Inactive
              </Button>
              {!showForceDelete ? (
                <Button
                  variant="outline"
                  onClick={() => setShowForceDelete(true)}
                  className="flex-1"
                >
                  Show Delete Options
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  onClick={handleForceDelete}
                  disabled={isLoading}
                  className="flex-1"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Force Delete
                </Button>
              )}
            </div>
          )}
          
          {!hasReferences && (
            <Button
              variant="destructive"
              onClick={handleSafeDelete}
              disabled={isLoading}
              className="w-full"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Item
            </Button>
          )}

          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setShowForceDelete(false);
            }}
            className="w-full"
          >
            Cancel
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}