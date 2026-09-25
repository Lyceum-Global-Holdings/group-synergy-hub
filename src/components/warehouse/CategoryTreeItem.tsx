import { useEffect, useState } from 'react';
import { ChevronRight, Edit, Trash2, Folder, FolderOpen, Tag, EyeOff, Eye, Globe, FolderInput } from 'lucide-react';
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
import { ItemCategory } from '@/types/itemBin';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { iconBtn } from '@/components/warehouse/master/masterUi';

interface CategoryTreeItemProps {
  category: ItemCategory;
  /** Direct children of any category (so every depth renders, not just two levels). */
  getChildren: (parentId: string) => ItemCategory[];
  level: number;
  onEdit: (category: ItemCategory) => void;
  onDelete: (categoryId: string) => void;
  onRestore?: (categoryId: string) => void;
  onMove?: (category: ItemCategory) => void;
  isDeleting?: boolean;
  canDelete?: boolean;
  isGlobal?: boolean;
  isHidden?: boolean;
  /** Bumped by "Expand all / Collapse all"; `expanded` is the state to apply. */
  expandSignal?: number;
  expanded?: boolean;
  /** Search term: branches open while searching and matching names are highlighted. */
  search?: string;
}

function matches(category: ItemCategory, q: string) {
  return category.name.toLowerCase().includes(q) || (category.code ?? '').toLowerCase().includes(q);
}

function Highlight({ text, q }: { text: string; q?: string }) {
  if (!q) return <>{text}</>;
  const i = text.toLowerCase().indexOf(q);
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded-sm bg-amber-200/70 px-0.5 text-foreground">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

export function CategoryTreeItem({
  category,
  getChildren,
  level,
  onEdit,
  onDelete,
  onRestore,
  onMove,
  isDeleting = false,
  canDelete = true,
  isGlobal = false,
  isHidden = false,
  expandSignal,
  expanded = false,
  search,
}: CategoryTreeItemProps) {
  const q = search?.trim().toLowerCase() || '';
  const children = getChildren(category.id);
  const hasChildren = children.length > 0;
  const [isOpen, setIsOpen] = useState(expanded);

  // Follow "Expand all / Collapse all".
  useEffect(() => {
    if (expandSignal !== undefined) setIsOpen(expanded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandSignal]);

  // While searching, open every branch so matches deeper down are visible.
  useEffect(() => {
    if (q) setIsOpen(true);
  }, [q]);

  // When searching, hide children that neither match nor lead to a match.
  const leadsToMatch = (c: ItemCategory): boolean => matches(c, q) || getChildren(c.id).some(leadsToMatch);
  const visibleChildren = q ? children.filter(leadsToMatch) : children;
  const isMatch = !!q && matches(category, q);

  const Icon = hasChildren ? (isOpen ? FolderOpen : Folder) : Tag;

  return (
    <div className="w-full">
      <div
        className={cn(
          'group flex items-center gap-2 py-2.5 pr-3 transition-colors hover:bg-[hsl(220_20%_98.3%)]',
          isHidden && 'opacity-60',
          isMatch && 'bg-amber-50/60',
        )}
        style={{ paddingLeft: `${12 + level * 22}px` }}
      >
        {/* Expand / collapse */}
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setIsOpen((o) => !o)}
            aria-expanded={isOpen}
            aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${category.name}`}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronRight className={cn('h-4 w-4 transition-transform duration-200', isOpen && 'rotate-90')} />
          </button>
        ) : (
          <span className="w-6 shrink-0" />
        )}

        <span
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
            level === 0 ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
          )}
        >
          <Icon className="h-4 w-4" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={cn('truncate', level === 0 ? 'font-semibold' : 'font-medium')}>
              <Highlight text={category.name} q={q} />
            </span>
            {category.code && (
              <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground/70">
                <Highlight text={category.code} q={q} />
              </span>
            )}
            {hasChildren && (
              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                {children.length} sub
              </span>
            )}
            {isGlobal && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex cursor-help items-center gap-1 rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">
                      <Globe className="h-3 w-3" />
                      Global
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>This is a shared category. It can be hidden from this company but not deleted.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {isHidden && (
              <span className="rounded-full border border-dashed border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">Hidden</span>
            )}
          </div>
          {category.description && (
            <div className="mt-0.5 truncate text-xs text-muted-foreground">{category.description}</div>
          )}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-0.5">
          {!isHidden && (
            <button type="button" className={iconBtn} onClick={() => onEdit(category)} title="Edit category" aria-label={`Edit ${category.name}`}>
              <Edit className="h-4 w-4" />
            </button>
          )}

          {!isHidden && onMove && (
            <button
              type="button"
              className={cn(iconBtn, 'hover:bg-primary/10 hover:text-primary')}
              onClick={() => onMove(category)}
              title="Move to another group"
              aria-label={`Move ${category.name}`}
            >
              <FolderInput className="h-4 w-4" />
            </button>
          )}

          {isHidden && onRestore ? (
            <button
              type="button"
              className={cn(iconBtn, 'hover:bg-primary/10 hover:text-primary')}
              disabled={isDeleting}
              onClick={() => onRestore(category.id)}
              title="Restore category"
              aria-label={`Restore ${category.name}`}
            >
              <Eye className="h-4 w-4" />
            </button>
          ) : canDelete && !isHidden ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  type="button"
                  disabled={isDeleting}
                  title={isGlobal ? 'Hide from this company' : 'Delete category'}
                  aria-label={isGlobal ? `Hide ${category.name}` : `Delete ${category.name}`}
                  className={cn(iconBtn, isGlobal ? 'hover:bg-orange-500/10 hover:text-orange-600' : 'hover:bg-destructive/10 hover:text-destructive')}
                >
                  {isGlobal ? <EyeOff className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{isGlobal ? 'Hide Category' : 'Delete Category'}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {isGlobal ? (
                      <>
                        Are you sure you want to hide "{category.name}" from this company?
                        {hasChildren && ' This will also hide all subcategories.'}
                        <br /><br />
                        <span className="text-muted-foreground">
                          This is a shared category used across companies. You can restore it later from the "Show Hidden" menu.
                        </span>
                      </>
                    ) : (
                      <>
                        Are you sure you want to delete "{category.name}"?
                        {hasChildren && ' This will also delete all subcategories.'}
                        <br /><br />
                        <span className="font-medium text-destructive">This action cannot be undone.</span>
                      </>
                    )}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDelete(category.id)}
                    className={isGlobal
                      ? 'bg-orange-500 text-white hover:bg-orange-600'
                      : 'bg-destructive text-destructive-foreground hover:bg-destructive/90'}
                  >
                    {isGlobal ? 'Hide' : 'Delete'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
        </div>
      </div>

      {/* Children — indented with a guide line */}
      {hasChildren && isOpen && visibleChildren.length > 0 && (
        <div className="relative">
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-2 top-0 border-l border-border"
            style={{ left: `${12 + level * 22 + 11}px` }}
          />
          {visibleChildren.map((child) => (
            <CategoryTreeItem
              key={child.id}
              category={child}
              getChildren={getChildren}
              level={level + 1}
              onEdit={onEdit}
              onDelete={onDelete}
              onRestore={onRestore}
              onMove={onMove}
              isDeleting={isDeleting}
              canDelete={canDelete}
              isGlobal={!child.company_id}
              isHidden={isHidden}
              expandSignal={expandSignal}
              expanded={expanded}
              search={search}
            />
          ))}
        </div>
      )}
    </div>
  );
}
