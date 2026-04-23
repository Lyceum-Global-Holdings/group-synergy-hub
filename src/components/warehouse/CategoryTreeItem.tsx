import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronRight, ChevronDown, Edit, Trash2, Tag, EyeOff, Eye, Globe, FolderInput } from 'lucide-react';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface CategoryTreeItemProps {
  category: ItemCategory;
  children: ItemCategory[];
  level: number;
  onEdit: (category: ItemCategory) => void;
  onDelete: (categoryId: string) => void;
  onRestore?: (categoryId: string) => void;
  onMove?: (category: ItemCategory) => void;
  isDeleting?: boolean;
  canDelete?: boolean;
  isGlobal?: boolean;
  isHidden?: boolean;
}

export function CategoryTreeItem({ 
  category, 
  children, 
  level, 
  onEdit, 
  onDelete,
  onRestore,
  onMove,
  isDeleting = false,
  canDelete = true,
  isGlobal = false,
  isHidden = false
}: CategoryTreeItemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const hasChildren = children.length > 0;

  return (
    <div className="w-full">
      <div 
        className={`flex items-center gap-2 p-3 hover:bg-muted/50 border-b ${isHidden ? 'opacity-60' : ''}`}
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
            {isGlobal && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="secondary" className="text-xs gap-1">
                      <Globe className="h-3 w-3" />
                      Global
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>This is a shared category. It can be hidden from this company but not deleted.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {isHidden && (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                Hidden
              </Badge>
            )}
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
          {!isHidden && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(category)}
              className="h-8 w-8 p-0"
            >
              <Edit className="h-4 w-4" />
            </Button>
          )}

          {!isHidden && onMove && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onMove(category)}
                    className="h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary"
                  >
                    <FolderInput className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Move to another group</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          {isHidden && onRestore ? (
            // Restore button for hidden categories
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isDeleting}
                    onClick={() => onRestore(category.id)}
                    className="h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Restore category</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : canDelete && !isHidden ? (
            // Delete/Hide button for visible categories
            <AlertDialog>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isDeleting}
                        className={`h-8 w-8 p-0 ${isGlobal ? 'hover:bg-orange-500/10 hover:text-orange-500' : 'hover:bg-destructive/10 hover:text-destructive'}`}
                      >
                        {isGlobal ? <EyeOff className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                      </Button>
                    </AlertDialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{isGlobal ? 'Hide from this company' : 'Delete category'}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {isGlobal ? 'Hide Category' : 'Delete Category'}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {isGlobal ? (
                      <>
                        Are you sure you want to hide "{category.name}" from this company? 
                        {hasChildren && " This will also hide all subcategories."}
                        <br /><br />
                        <span className="text-muted-foreground">
                          This is a shared category used across companies. You can restore it later from the "Show Hidden" menu.
                        </span>
                      </>
                    ) : (
                      <>
                        Are you sure you want to delete "{category.name}"? 
                        {hasChildren && " This will also delete all subcategories."}
                        <br /><br />
                        <span className="text-destructive font-medium">This action cannot be undone.</span>
                      </>
                    )}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDelete(category.id)}
                    className={isGlobal 
                      ? "bg-orange-500 text-white hover:bg-orange-600" 
                      : "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    }
                  >
                    {isGlobal ? 'Hide' : 'Delete'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
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
                  onRestore={onRestore}
                  onMove={onMove}
                  isDeleting={isDeleting}
                  canDelete={canDelete}
                  isGlobal={!child.company_id}
                  isHidden={isHidden}
                />
              );
            })}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
