import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronRight, ChevronDown, Edit, Trash2, Tag } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { ItemCategory } from '@/types/itemBin';

interface CategoryTreeItemProps {
  category: ItemCategory;
  children: ItemCategory[];
  level: number;
  onEdit: (category: ItemCategory) => void;
  onDelete: (categoryId: string) => void;
  isDeleting?: boolean;
}

export function CategoryTreeItem({ 
  category, 
  children, 
  level, 
  onEdit, 
  onDelete,
  isDeleting = false
}: CategoryTreeItemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const hasChildren = children.length > 0;

  return (
    <div className="w-full">
      <div 
        className="flex items-center gap-2 p-3 hover:bg-muted/50 border-b"
        style={{ paddingLeft: `${12 + (level * 24)}px` }}
      >
        {/* Expand/Collapse Button */}
        {hasChildren ? (
          <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                {isOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
        ) : (
          <div className="w-6" />
        )}

        {/* Category Icon */}
        <Tag className="h-4 w-4 text-muted-foreground" />

        {/* Category Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{category.name}</span>
            <Badge variant="outline" className="text-xs">
              Level {level}
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
            <span>Code: {category.code || '-'}</span>
            {category.description && (
              <span className="truncate">Desc: {category.description}</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(category)}
            className="h-8 w-8 p-0"
          >
            <Edit className="h-4 w-4" />
          </Button>
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                disabled={isDeleting}
                className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Category</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete "{category.name}"? 
                  {hasChildren && " This will also delete all subcategories."}
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(category.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Children */}
      {hasChildren && (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleContent>
            {children.map((child) => {
              const grandChildren = children.filter(c => c.parent_id === child.id);
              return (
                <CategoryTreeItem
                  key={child.id}
                  category={child}
                  children={grandChildren}
                  level={level + 1}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  isDeleting={isDeleting}
                />
              );
            })}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}