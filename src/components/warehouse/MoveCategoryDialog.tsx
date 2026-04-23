import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { ItemCategory } from '@/types/itemBin';
import { ChevronRight, FolderInput, Search, Globe, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MoveCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: ItemCategory | null;
  allCategories: ItemCategory[];
  onConfirm: (newParentId: string | null) => void;
  isMoving?: boolean;
}

const TOP_LEVEL_VALUE = '__TOP_LEVEL__';

export function MoveCategoryDialog({
  open,
  onOpenChange,
  category,
  allCategories,
  onConfirm,
  isMoving = false,
}: MoveCategoryDialogProps) {
  const [search, setSearch] = useState('');
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);

  // Reset selection when dialog opens for a new category
  const dialogKey = category?.id ?? 'none';

  // Compute descendants of source (cycle prevention)
  const descendantIds = useMemo(() => {
    if (!category) return new Set<string>();
    const set = new Set<string>();
    const stack = [category.id];
    while (stack.length) {
      const id = stack.pop()!;
      allCategories
        .filter((c) => c.parent_id === id)
        .forEach((c) => {
          if (!set.has(c.id)) {
            set.add(c.id);
            stack.push(c.id);
          }
        });
    }
    return set;
  }, [category, allCategories]);

  // Source's own children — needed for impact summary and the "would push to L2" rule
  const sourceHasChildren = useMemo(() => {
    if (!category) return false;
    return allCategories.some((c) => c.parent_id === category.id);
  }, [category, allCategories]);

  const subcategoryCount = useMemo(() => descendantIds.size, [descendantIds]);

  // Current parent breadcrumb
  const currentParent = useMemo(() => {
    if (!category?.parent_id) return null;
    return allCategories.find((c) => c.id === category.parent_id) ?? null;
  }, [category, allCategories]);

  // Build candidate list: only Level 0 categories (parent_id === null) qualify as parents,
  // since the system enforces a 2-level max.
  const candidates = useMemo(() => {
    if (!category) return [] as ItemCategory[];
    const isGlobalSource = !category.company_id;

    return allCategories
      .filter((c) => !c.parent_id) // Level 0 only
      .filter((c) => c.id !== category.id) // not self
      .filter((c) => !descendantIds.has(c.id)) // no cycles
      .filter((c) => {
        // Global source can only move under another global parent
        if (isGlobalSource) return !c.company_id;
        return true;
      })
      .filter((c) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          (c.code ?? '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allCategories, category, descendantIds, search]);

  if (!category) return null;

  const isAlreadyAtTop = !category.parent_id;
  const wouldPushToLevel2 = sourceHasChildren && selectedParentId !== null && selectedParentId !== TOP_LEVEL_VALUE;

  const handleConfirm = () => {
    if (!selectedParentId) return;
    const newParentId = selectedParentId === TOP_LEVEL_VALUE ? null : selectedParentId;
    // No-op if user picked the same parent
    if (newParentId === (category.parent_id ?? null)) {
      onOpenChange(false);
      return;
    }
    onConfirm(newParentId);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setSearch('');
          setSelectedParentId(null);
        }
        onOpenChange(o);
      }}
    >
      <DialogContent key={dialogKey} className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderInput className="h-5 w-5" />
            Move Category
          </DialogTitle>
          <DialogDescription>
            Re-parent this category. Items linked to it stay assigned.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Source */}
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="text-xs font-medium text-muted-foreground mb-1">Source</div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium">{category.name}</span>
              {category.code && (
                <Badge variant="outline" className="text-xs">{category.code}</Badge>
              )}
              {!category.company_id && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <Globe className="h-3 w-3" /> Global
                </Badge>
              )}
            </div>
            <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
              <span>Current parent:</span>
              {currentParent ? (
                <>
                  <span className="font-medium text-foreground">{currentParent.name}</span>
                </>
              ) : (
                <span className="font-medium text-foreground">— Top Level —</span>
              )}
            </div>
            {subcategoryCount > 0 && (
              <div className="mt-1 text-xs text-muted-foreground">
                {subcategoryCount} subcategor{subcategoryCount === 1 ? 'y' : 'ies'} will move with it.
              </div>
            )}
          </div>

          {/* Destination */}
          <div className="space-y-2">
            <Label className="text-sm">Destination parent</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Level 0 categories..."
                className="pl-8"
              />
            </div>

            <ScrollArea className="h-64 rounded-md border">
              <div className="p-1">
                {/* Top level option */}
                <button
                  type="button"
                  onClick={() => setSelectedParentId(TOP_LEVEL_VALUE)}
                  disabled={isAlreadyAtTop}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-sm text-sm flex items-center gap-2 transition-colors',
                    selectedParentId === TOP_LEVEL_VALUE
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted',
                    isAlreadyAtTop && 'opacity-50 cursor-not-allowed',
                  )}
                >
                  <ChevronRight className="h-3 w-3" />
                  <span className="font-medium">— Move to Top Level (Level 0) —</span>
                  {isAlreadyAtTop && (
                    <span className="ml-auto text-xs">(already top)</span>
                  )}
                </button>

                <div className="my-1 border-t" />

                {candidates.length === 0 ? (
                  <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                    No eligible parent categories.
                  </div>
                ) : (
                  candidates.map((c) => {
                    const isCurrent = c.id === category.parent_id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedParentId(c.id)}
                        className={cn(
                          'w-full text-left px-3 py-2 rounded-sm text-sm flex items-center gap-2 transition-colors',
                          selectedParentId === c.id
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-muted',
                        )}
                      >
                        <span className="font-medium">{c.name}</span>
                        {c.code && (
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-xs',
                              selectedParentId === c.id && 'bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground',
                            )}
                          >
                            {c.code}
                          </Badge>
                        )}
                        {!c.company_id && (
                          <Globe className="h-3 w-3 opacity-70" />
                        )}
                        {isCurrent && (
                          <span className="ml-auto text-xs opacity-70">(current)</span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Validation warning */}
          {wouldPushToLevel2 && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                This category has subcategories. Moving it under another category would create a
                3-level hierarchy. Move it to Top Level instead, or move its subcategories first.
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isMoving}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={
              !selectedParentId ||
              isMoving ||
              wouldPushToLevel2 ||
              (selectedParentId === TOP_LEVEL_VALUE && isAlreadyAtTop)
            }
          >
            {isMoving ? 'Moving...' : 'Move Category'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
