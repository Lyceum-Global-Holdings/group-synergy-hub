import { useState, useMemo } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, CheckSquare, Square, Loader2 } from 'lucide-react';
import { ItemCategory } from '@/types/itemBin';
import { Badge } from '@/components/ui/badge';

interface CategoryVisibilityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allCategories: ItemCategory[];
  excludedCategoryIds: string[];
  onSave: (params: { toExclude: string[], toRestore: string[] }) => Promise<void>;
  isSaving: boolean;
}

export function CategoryVisibilityDialog({
  open,
  onOpenChange,
  allCategories,
  excludedCategoryIds,
  onSave,
  isSaving,
}: CategoryVisibilityDialogProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    // Initialize with visible categories (not in excludedCategoryIds)
    const visible = new Set(allCategories.map(c => c.id));
    excludedCategoryIds.forEach(id => visible.delete(id));
    return visible;
  });

  // Reset selected IDs when dialog opens
  useMemo(() => {
    if (open) {
      const visible = new Set(allCategories.map(c => c.id));
      excludedCategoryIds.forEach(id => visible.delete(id));
      setSelectedIds(visible);
      setSearchTerm('');
    }
  }, [open, allCategories, excludedCategoryIds]);

  // Filter categories by search
  const filteredCategories = useMemo(() => {
    if (!searchTerm.trim()) return allCategories;
    const term = searchTerm.toLowerCase();
    return allCategories.filter(
      c => c.name.toLowerCase().includes(term) || 
           (c.code && c.code.toLowerCase().includes(term))
    );
  }, [allCategories, searchTerm]);

  // Group categories by parent for display
  const categoriesByParent = useMemo(() => {
    const rootCategories = filteredCategories.filter(c => !c.parent_id);
    const childrenMap = new Map<string, ItemCategory[]>();
    
    filteredCategories.forEach(category => {
      if (category.parent_id) {
        const children = childrenMap.get(category.parent_id) || [];
        children.push(category);
        childrenMap.set(category.parent_id, children);
      }
    });

    return { rootCategories, childrenMap };
  }, [filteredCategories]);

  const toggleCategory = (categoryId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(allCategories.map(c => c.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleSave = async () => {
    // Find categories to exclude (currently visible but now unchecked)
    const toExclude = allCategories
      .filter(c => !selectedIds.has(c.id) && !excludedCategoryIds.includes(c.id))
      .map(c => c.id);
    
    // Find categories to restore (currently hidden but now checked)
    const toRestore = excludedCategoryIds.filter(id => selectedIds.has(id));

    await onSave({ toExclude, toRestore });
    onOpenChange(false);
  };

  const visibleCount = selectedIds.size;
  const hiddenCount = allCategories.length - selectedIds.size;

  const renderCategory = (category: ItemCategory, level: number = 0) => {
    const children = categoriesByParent.childrenMap.get(category.id) || [];
    const isChecked = selectedIds.has(category.id);
    
    return (
      <div key={category.id}>
        <div 
          className="flex items-center space-x-3 py-2 px-3 hover:bg-muted/50 rounded-sm cursor-pointer"
          style={{ paddingLeft: `${12 + level * 24}px` }}
          onClick={() => toggleCategory(category.id)}
        >
          <Checkbox 
            checked={isChecked} 
            onCheckedChange={() => toggleCategory(category.id)}
          />
          <div className="flex-1 flex items-center gap-2">
            <span className={!isChecked ? 'text-muted-foreground line-through' : ''}>
              {category.name}
            </span>
            {category.code && (
              <span className="text-xs text-muted-foreground">({category.code})</span>
            )}
            {!category.company_id && (
              <Badge variant="outline" className="text-xs">Global</Badge>
            )}
          </div>
        </div>
        {children.map(child => renderCategory(child, level + 1))}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Manage Category Visibility</DialogTitle>
          <DialogDescription>
            Select which categories should be visible for this company. Unchecked categories will be hidden from dropdowns and lists.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Search and actions */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search categories..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Button variant="outline" size="sm" onClick={selectAll}>
              <CheckSquare className="mr-2 h-4 w-4" />
              Select All
            </Button>
            <Button variant="outline" size="sm" onClick={deselectAll}>
              <Square className="mr-2 h-4 w-4" />
              Deselect All
            </Button>
          </div>

          {/* Stats */}
          <div className="flex gap-4 text-sm">
            <span className="text-muted-foreground">
              Visible: <span className="text-foreground font-medium">{visibleCount}</span>
            </span>
            <span className="text-muted-foreground">
              Hidden: <span className="text-foreground font-medium">{hiddenCount}</span>
            </span>
          </div>

          {/* Category list */}
          <ScrollArea className="flex-1 border rounded-md">
            <div className="p-2">
              {filteredCategories.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  {searchTerm ? 'No categories match your search.' : 'No categories found.'}
                </div>
              ) : (
                categoriesByParent.rootCategories.map(category => renderCategory(category))
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
