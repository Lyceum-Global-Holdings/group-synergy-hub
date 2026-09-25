import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Download, ChevronsDownUp, ChevronsUpDown, EyeOff, Settings, Tags, FolderTree, Folder, Tag } from 'lucide-react';
import { useItemCategories } from '@/hooks/useItemCategories';
import { CreateCategoryDialog } from '@/components/warehouse/CreateCategoryDialog';
import { ImportCategoriesDialog } from '@/components/warehouse/ImportCategoriesDialog';
import { CategoryVisibilityDialog } from '@/components/warehouse/CategoryVisibilityDialog';
import { CategoryTreeItem } from '@/components/warehouse/CategoryTreeItem';
import { MoveCategoryDialog } from '@/components/warehouse/MoveCategoryDialog';
import { ItemCategory } from '@/types/itemBin';
import { useCompany } from '@/contexts/CompanyContext';
import { DataCard, EmptyState, SearchField, StatTile, Toolbar, pillButton } from '@/components/warehouse/master/masterUi';

export function ItemCategoriesTab() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isVisibilityDialogOpen, setIsVisibilityDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ItemCategory | null>(null);
  const [expandedAll, setExpandedAll] = useState(false);
  // Bumped on every Expand/Collapse-all click so each tree row applies it.
  const [expandSignal, setExpandSignal] = useState(0);
  const toggleExpandAll = () => {
    setExpandedAll((v) => !v);
    setExpandSignal((n) => n + 1);
  };
  const [showHiddenCategories, setShowHiddenCategories] = useState(false);
  const [movingCategory, setMovingCategory] = useState<ItemCategory | null>(null);
  
  const { selectedCompany } = useCompany();
  const { 
    categories, 
    hiddenCategories,
    allCategories,
    excludedCategoryIds,
    isLoading, 
    deleteCategory, 
    isDeleting,
    excludeCategory,
    isExcluding,
    restoreCategory,
    isRestoring,
    bulkUpdateVisibility,
    isBulkUpdating,
    moveCategory,
    isMoving
  } = useItemCategories(selectedCompany?.id);

  // Build category tree structure
  const categoryTree = useMemo(() => {
    const rootCategories = categories.filter(cat => !cat.parent_id);
    const childrenMap = new Map<string, ItemCategory[]>();
    
    // Group children by parent_id
    categories.forEach(category => {
      if (category.parent_id) {
        const children = childrenMap.get(category.parent_id) || [];
        children.push(category);
        childrenMap.set(category.parent_id, children);
      }
    });

    // Helper function to get children recursively
    const getChildren = (parentId: string): ItemCategory[] => {
      return childrenMap.get(parentId) || [];
    };

    return { rootCategories, getChildren };
  }, [categories]);

  // Build hidden category tree structure
  const hiddenCategoryTree = useMemo(() => {
    const rootCategories = hiddenCategories.filter(cat => !cat.parent_id);
    const childrenMap = new Map<string, ItemCategory[]>();
    
    hiddenCategories.forEach(category => {
      if (category.parent_id) {
        const children = childrenMap.get(category.parent_id) || [];
        children.push(category);
        childrenMap.set(category.parent_id, children);
      }
    });

    const getChildren = (parentId: string): ItemCategory[] => {
      return childrenMap.get(parentId) || [];
    };

    return { rootCategories, getChildren };
  }, [hiddenCategories]);

  // Filter categories based on search
  const filteredRootCategories = useMemo(() => {
    if (!searchTerm.trim()) {
      return categoryTree.rootCategories;
    }

    const matchesSearch = (category: ItemCategory): boolean => {
      return category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (category.code && category.code.toLowerCase().includes(searchTerm.toLowerCase()));
    };

    // Include root categories that match or have matching descendants
    const hasMatchingDescendant = (category: ItemCategory): boolean => {
      if (matchesSearch(category)) return true;
      const children = categoryTree.getChildren(category.id);
      return children.some(child => hasMatchingDescendant(child));
    };

    return categoryTree.rootCategories.filter(hasMatchingDescendant);
  }, [categoryTree, searchTerm]);

  const handleDeleteById = (categoryId: string) => {
    // Resolve the actual target category from the id passed by CategoryTreeItem.
    // This avoids closure bugs where a parent's onDelete is invoked for a child.
    const target = allCategories.find((c) => c.id === categoryId);
    if (!target) return;
    // If it's a global category (company_id is null), hide it instead of deleting
    if (!target.company_id && selectedCompany?.id) {
      excludeCategory(target.id);
    } else {
      // Company-specific category - actually delete it
      deleteCategory(target.id);
    }
  };

  const handleRestoreCategory = (categoryId: string) => {
    restoreCategory(categoryId);
  };

  const subCount = categories.filter((c) => !!c.parent_id).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={Tags} label="Categories" value={categories.length.toLocaleString('en-US')} loading={isLoading} hint="Visible to this company" />
        <StatTile icon={Folder} label="Top-level groups" value={categoryTree.rootCategories.length.toLocaleString('en-US')} loading={isLoading} />
        <StatTile icon={FolderTree} label="Sub-categories" value={subCount.toLocaleString('en-US')} loading={isLoading} />
        <StatTile
          icon={EyeOff}
          label="Hidden"
          value={hiddenCategories.length.toLocaleString('en-US')}
          loading={isLoading}
          hint={hiddenCategories.length ? (showHiddenCategories ? 'Click to hide the list' : 'Click to show hidden categories') : 'No hidden categories'}
          onClick={hiddenCategories.length ? () => setShowHiddenCategories((v) => !v) : undefined}
          active={showHiddenCategories}
        />
      </div>

      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <SearchField value={searchTerm} onChange={setSearchTerm} placeholder="Search category name or code…" />
          {categories.length > 0 && (
            <Button variant="outline" size="sm" className={pillButton} onClick={toggleExpandAll}>
              {expandedAll ? <ChevronsDownUp className="mr-2 h-4 w-4" /> : <ChevronsUpDown className="mr-2 h-4 w-4" />}
              {expandedAll ? 'Collapse all' : 'Expand all'}
            </Button>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className={pillButton} onClick={() => setIsVisibilityDialogOpen(true)}>
              <Settings className="mr-2 h-4 w-4" />
              Visibility
            </Button>
            <Button variant="outline" size="sm" className={pillButton} onClick={() => setIsImportDialogOpen(true)}>
              <Download className="mr-2 h-4 w-4" />
              Import standards
            </Button>
            <Button size="sm" className="h-9 rounded-full px-4" onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add category
            </Button>
          </div>
        </div>
      </Toolbar>

      {/* Category tree */}
      <DataCard
        footer={
          !isLoading && filteredRootCategories.length > 0
            ? searchTerm
              ? `${filteredRootCategories.length} group${filteredRootCategories.length === 1 ? '' : 's'} contain matches`
              : `${categoryTree.rootCategories.length} groups · ${subCount} sub-categories`
            : undefined
        }
      >
        {isLoading ? (
          <div className="divide-y divide-border/50">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="h-8 w-8 animate-pulse rounded-lg bg-muted" />
                <div className="h-3.5 w-56 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : filteredRootCategories.length === 0 ? (
          <EmptyState
            icon={Tag}
            title={searchTerm ? 'No categories match' : 'No categories yet'}
            description={
              searchTerm
                ? 'Try another name or code.'
                : 'Create your first category, or import the standard set to get started quickly.'
            }
            action={
              searchTerm ? (
                <Button variant="outline" size="sm" className="rounded-full" onClick={() => setSearchTerm('')}>
                  Clear search
                </Button>
              ) : (
                <Button variant="outline" size="sm" className="rounded-full" onClick={() => setIsImportDialogOpen(true)}>
                  <Download className="mr-1.5 h-4 w-4" /> Import standard categories
                </Button>
              )
            }
          />
        ) : (
          <div className="max-h-[max(420px,calc(100svh-400px))] divide-y divide-border/50 overflow-auto">
            {filteredRootCategories.map((category) => (
              <CategoryTreeItem
                key={category.id}
                category={category}
                getChildren={categoryTree.getChildren}
                level={0}
                onEdit={setEditingCategory}
                onDelete={handleDeleteById}
                onMove={setMovingCategory}
                isDeleting={isDeleting || isExcluding}
                isGlobal={!category.company_id}
                expandSignal={expandSignal}
                expanded={expandedAll}
                search={searchTerm}
              />
            ))}
          </div>
        )}
      </DataCard>

      {/* Hidden categories */}
      {showHiddenCategories && hiddenCategories.length > 0 && (
        <div className="space-y-2">
          <h3 className="flex items-center gap-2 px-1 text-sm font-semibold text-muted-foreground">
            <EyeOff className="h-4 w-4" />
            Hidden categories
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{hiddenCategories.length}</span>
          </h3>
          <div className="overflow-hidden rounded-2xl border border-dashed border-border bg-muted/20">
            <div className="divide-y divide-border/50">
              {hiddenCategoryTree.rootCategories.map((category) => (
                <CategoryTreeItem
                  key={category.id}
                  category={category}
                  getChildren={hiddenCategoryTree.getChildren}
                  level={0}
                  onEdit={setEditingCategory}
                  onDelete={handleDeleteById}
                  onRestore={handleRestoreCategory}
                  isDeleting={isRestoring}
                  isHidden={true}
                  isGlobal={!category.company_id}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <CreateCategoryDialog
        open={isCreateDialogOpen || editingCategory !== null}
        onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (!open) setEditingCategory(null);
        }}
        editingCategory={editingCategory}
        companyId={selectedCompany?.id}
      />

      <ImportCategoriesDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        companyId={selectedCompany?.id}
      />

      <CategoryVisibilityDialog
        open={isVisibilityDialogOpen}
        onOpenChange={setIsVisibilityDialogOpen}
        allCategories={allCategories}
        excludedCategoryIds={excludedCategoryIds}
        onSave={bulkUpdateVisibility}
        isSaving={isBulkUpdating}
      />

      <MoveCategoryDialog
        open={movingCategory !== null}
        onOpenChange={(open) => { if (!open) setMovingCategory(null); }}
        category={movingCategory}
        allCategories={allCategories}
        isMoving={isMoving}
        onConfirm={(newParentId) => {
          if (!movingCategory) return;
          moveCategory(
            { id: movingCategory.id, newParentId },
            { onSuccess: () => setMovingCategory(null) }
          );
        }}
      />
    </div>
  );
}
