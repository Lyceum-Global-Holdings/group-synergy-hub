import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Trash2, Plus, Edit2, FolderOpen, Package } from 'lucide-react';
import { useAssetCategories } from '@/hooks/useAssetCategories';

export const CategoryManagementDialog = () => {
  const [open, setOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    parent_id: '',
    description: ''
  });

  const { 
    categories, 
    mainCategories, 
    getSubcategories, 
    createCategory, 
    updateCategory, 
    deleteCategory,
    isCreating,
    isUpdating,
    isDeleting
  } = useAssetCategories();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) return;

    const categoryData = {
      name: formData.name,
      parent_id: formData.parent_id || null,
      description: formData.description || null
    };

    if (editingCategory) {
      updateCategory({ id: editingCategory, ...categoryData });
    } else {
      createCategory(categoryData);
    }

    resetForm();
  };

  const resetForm = () => {
    setFormData({ name: '', parent_id: '', description: '' });
    setEditingCategory(null);
  };

  const handleEdit = (category: any) => {
    setFormData({
      name: category.name,
      parent_id: category.parent_id || '',
      description: category.description || ''
    });
    setEditingCategory(category.id);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this category? This will also delete all its subcategories.')) {
      deleteCategory(id);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Package className="h-4 w-4 mr-2" />
          Manage Categories
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Category Management</DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Form Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">
              {editingCategory ? 'Edit Category' : 'Add New Category'}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Category Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter category name"
                  required
                />
              </div>

              <div>
                <Label htmlFor="parent_id">Parent Category (Optional)</Label>
                <Select
                  value={formData.parent_id}
                  onValueChange={(value) => setFormData({ ...formData, parent_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select parent category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None (Main Category)</SelectItem>
                    {mainCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Enter category description"
                  rows={3}
                />
              </div>

              <div className="flex gap-2">
                <Button 
                  type="submit" 
                  disabled={isCreating || isUpdating}
                  className="flex-1"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {editingCategory ? 'Update Category' : 'Add Category'}
                </Button>
                {editingCategory && (
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </div>

          {/* Categories List */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Existing Categories</h3>
            
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {mainCategories.map((category) => (
                <div key={category.id} className="space-y-2">
                  {/* Main Category */}
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <FolderOpen className="h-4 w-4 text-primary" />
                      <div>
                        <div className="font-medium">{category.name}</div>
                        {category.description && (
                          <div className="text-sm text-muted-foreground">
                            {category.description}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(category)}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(category.id)}
                        disabled={isDeleting}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Subcategories */}
                  {getSubcategories(category.id).map((subcategory) => (
                    <div
                      key={subcategory.id}
                      className="flex items-center justify-between p-2 ml-6 bg-background border rounded"
                    >
                      <div className="flex items-center gap-2">
                        <Package className="h-3 w-3 text-muted-foreground" />
                        <div>
                          <div className="text-sm font-medium">{subcategory.name}</div>
                          {subcategory.description && (
                            <div className="text-xs text-muted-foreground">
                              {subcategory.description}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(subcategory)}
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(subcategory.id)}
                          disabled={isDeleting}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};