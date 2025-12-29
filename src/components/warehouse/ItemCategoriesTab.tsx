import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Download, ChevronDown, ChevronRight } from 'lucide-react';
import { useItemCategories } from '@/hooks/useItemCategories';
import { CreateCategoryDialog } from '@/components/warehouse/CreateCategoryDialog';
import { ImportCategoriesDialog } from '@/components/warehouse/ImportCategoriesDialog';
import { CategoryTreeItem } from '@/components/warehouse/CategoryTreeItem';
import { ItemCategory } from '@/types/itemBin';
import { useCompany } from '@/contexts/CompanyContext';

export function ItemCategoriesTab() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ItemCategory | null>(null);
  const [expandedAll, setExpandedAll] = useState(false);
  
  const { selectedCompany } = useCompany();
  const { categories, isLoading, deleteCategory, isDeleting } = useItemCategories(selectedCompany?.id);

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

  const handleDeleteCategory = (categoryId: string) => {
    deleteCategory(categoryId);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 w-64"
            />
          </div>
          {categories.length > 0 && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setExpandedAll(!expandedAll)}
            >
              {expandedAll ? (
                <>
                  <ChevronDown className="mr-2 h-4 w-4" />
                  Collapse All
                </>
              ) : (
                <>
                  <ChevronRight className="mr-2 h-4 w-4" />
                  Expand All
                </>
              )}
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsImportDialogOpen(true)}>
            <Download className="mr-2 h-4 w-4" />
            Import Standard Categories
          </Button>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Category
          </Button>
        </div>
      </div>

      {/* Category Tree */}
      <div className="border rounded-lg bg-card">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">
            Loading categories...
          </div>
        ) : filteredRootCategories.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            {searchTerm ? 'No categories found matching your search.' : 'No categories found. Create your first category to get started.'}
          </div>
        ) : (
          <div className="divide-y">
            {filteredRootCategories.map((category) => (
              <CategoryTreeItem
                key={category.id}
                category={category}
                children={categoryTree.getChildren(category.id)}
                level={0}
                onEdit={setEditingCategory}
                onDelete={handleDeleteCategory}
                isDeleting={isDeleting}
              />
            ))}
          </div>
        )}
      </div>

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
    </div>
  );
}