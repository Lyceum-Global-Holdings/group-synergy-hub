import { useEffect, useMemo, useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Archive, Trash2, ShieldAlert } from 'lucide-react';
import { useItemReferences } from '@/hooks/useItemReferences';
import { useIsAdminOrHigher } from '@/hooks/useIsAdminOrHigher';
import { usePurgeInactiveItem } from '@/hooks/warehouse/usePurgeInactiveItem';
import { WarehouseItem, CatalogItem } from '@/types/itemBin';

interface DeleteItemConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: WarehouseItem | CatalogItem | null;
  onConfirmDelete: (itemId: string, forceDelete: boolean) => void;
  onMarkInactive: (itemId: string) => void;
  isLoading: boolean;
}

const MIN_INACTIVE_DAYS = 30;

export function DeleteItemConfirmationDialog({
  open,
  onOpenChange,
  item,
  onConfirmDelete,
  onMarkInactive,
  isLoading,
}: DeleteItemConfirmationDialogProps) {
  const [showForceDelete, setShowForceDelete] = useState(false);
  const [showPurge, setShowPurge] = useState(false);
  const [confirmCode, setConfirmCode] = useState('');
  const [reason, setReason] = useState('');

  const { data: references = [], isLoading: isCheckingReferences } = useItemReferences(item?.id || '');
  const { canDelete: isAdminOrHigher } = useIsAdminOrHigher();
  const { purgeItem, isPurging } = usePurgeInactiveItem();

  const hasReferences = references.length > 0;
  const isInactive = (item as WarehouseItem | null)?.status === 'inactive';

  const inactiveSinceDays = useMemo(() => {
    const ts = (item as { updated_at?: string | null } | null)?.updated_at
      ?? (item as { created_at?: string | null } | null)?.created_at;
    if (!ts) return null;
    return Math.floor((Date.now() - new Date(ts).getTime()) / (1000 * 60 * 60 * 24));
  }, [item]);

  const eligibleForPurge =
    isInactive &&
    !hasReferences &&
    isAdminOrHigher &&
    inactiveSinceDays !== null &&
    inactiveSinceDays >= MIN_INACTIVE_DAYS;

  useEffect(() => {
    if (!open) {
      setShowForceDelete(false);
      setShowPurge(false);
      setConfirmCode('');
      setReason('');
    }
  }, [open]);

  if (!item) return null;

  const handleMarkInactive = () => {
    onMarkInactive(item.id);
    onOpenChange(false);
  };

  const handleSafeDelete = () => {
    onConfirmDelete(item.id, false);
    onOpenChange(false);
  };

  const handleForceDelete = () => {
    onConfirmDelete(item.id, true);
    onOpenChange(false);
  };

  const handlePurge = async () => {
    try {
      await purgeItem({ itemId: item.id, reason: reason.trim() });
      onOpenChange(false);
    } catch {
      // toast handled in hook
    }
  };

  const purgeReady =
    confirmCode.trim() === item.item_code && reason.trim().length >= 5;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            {showPurge ? 'Permanently Delete Item' : 'Delete Item Confirmation'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            You are about to delete <strong>{item.name}</strong> ({item.item_code}).
          </AlertDialogDescription>
        </AlertDialogHeader>

        {showPurge ? (
          <div className="space-y-3">
            <Alert variant="destructive">
              <ShieldAlert className="h-4 w-4" />
              <AlertDescription>
                This permanently removes the item from the database. This cannot be undone.
                A snapshot is recorded in the security audit log.
              </AlertDescription>
            </Alert>
            <div>
              <Label className="text-xs">
                Type <span className="font-mono">{item.item_code}</span> to confirm
              </Label>
              <Input
                value={confirmCode}
                onChange={(e) => setConfirmCode(e.target.value)}
                placeholder={item.item_code}
                className="font-mono"
              />
            </div>
            <div>
              <Label className="text-xs">Reason (required, ≥5 chars — logged)</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="Obsolete SKU, replaced by ITEM-456 …"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {isCheckingReferences ? (
              <div className="text-sm text-muted-foreground">Checking for references…</div>
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
                        <Badge variant="secondary">
                          {ref.count} record{ref.count !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
                <Alert>
                  <AlertDescription>
                    <strong>Recommended:</strong> Mark as inactive to preserve data integrity.
                  </AlertDescription>
                </Alert>
              </div>
            ) : isInactive && isAdminOrHigher ? (
              <Alert>
                <AlertDescription>
                  {eligibleForPurge ? (
                    <>This item has been Inactive for {inactiveSinceDays} days and has no references — it can be permanently deleted.</>
                  ) : (
                    <>
                      Items must be Inactive for at least {MIN_INACTIVE_DAYS} days before they can be permanently deleted.
                      {inactiveSinceDays !== null && <> (Currently {inactiveSinceDays} days.)</>}
                    </>
                  )}
                </AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <AlertDescription>
                  This item has no references and can be safely deleted.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <AlertDialogFooter className="flex-col gap-2">
          {showPurge ? (
            <>
              <Button
                variant="destructive"
                onClick={handlePurge}
                disabled={!purgeReady || isPurging}
                className="w-full"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {isPurging ? 'Purging…' : 'Permanently Delete'}
              </Button>
              <Button variant="outline" onClick={() => setShowPurge(false)} className="w-full">
                Back
              </Button>
            </>
          ) : (
            <>
              {hasReferences && (
                <div className="flex gap-2 w-full">
                  <Button variant="outline" onClick={handleMarkInactive} disabled={isLoading} className="flex-1">
                    <Archive className="mr-2 h-4 w-4" />
                    Mark Inactive
                  </Button>
                  {!showForceDelete ? (
                    <Button variant="outline" onClick={() => setShowForceDelete(true)} className="flex-1">
                      Show Delete Options
                    </Button>
                  ) : (
                    <Button variant="destructive" onClick={handleForceDelete} disabled={isLoading} className="flex-1">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Force Delete
                    </Button>
                  )}
                </div>
              )}

              {!hasReferences && !isInactive && (
                <Button variant="destructive" onClick={handleSafeDelete} disabled={isLoading} className="w-full">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Item
                </Button>
              )}

              {!hasReferences && isInactive && (
                <>
                  <Button
                    variant="destructive"
                    onClick={() => setShowPurge(true)}
                    disabled={!eligibleForPurge}
                    className="w-full"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Permanently Delete…
                  </Button>
                  {!isAdminOrHigher && (
                    <p className="text-xs text-muted-foreground text-center">
                      Admin role required for permanent deletion.
                    </p>
                  )}
                </>
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
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
