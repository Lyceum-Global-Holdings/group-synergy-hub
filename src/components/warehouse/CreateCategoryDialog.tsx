import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useItemCategories } from '@/hooks/useItemCategories';
import { ItemCategory } from '@/types/itemBin';

interface CreateCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingCategory?: ItemCategory | null;
}

export function CreateCategoryDialog({ open, onOpenChange, editingCategory }: CreateCategoryDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    parent_id: ''
  });

  const { categories, createCategory, isCreating } = useItemCategories();

  useEffect(() => {
    if (editingCategory) {
      setFormData({
        name: editingCategory.name,
        code: editingCategory.code || '',
        description: editingCategory.description || '',
        parent_id: editingCategory.parent_id || ''
      });
    } else {
      setFormData({
        name: '',
        code: '',
        description: '',
        parent_id: ''
      });
    }
  }, [editingCategory, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const categoryData = {
      name: formData.name,
      code: formData.code || null,
      description: formData.description || null,
      parent_id: formData.parent_id || null
    };

    createCategory(categoryData);
    onOpenChange(false);
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Filter out the current category from parent options to prevent circular references
  const availableParentCategories = categories.filter(cat => cat.id !== editingCategory?.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {editingCategory ? 'Edit Category' : 'Create New Category'}
          </DialogTitle>
          <DialogDescription>
            {editingCategory ? 'Update category information' : 'Add a new item category to organize your inventory'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Category Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="e.g., Electronics"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Category Code</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => handleChange('code', e.target.value)}
                placeholder="e.g., ELEC"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="parent_id">Parent Category</Label>
            <Select value={formData.parent_id} onValueChange={(value) => handleChange('parent_id', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select parent category (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None (Top Level)</SelectItem>
                {availableParentCategories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Describe this category and what items it contains"
              rows={3}
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating}>
              {editingCategory ? 'Update Category' : 'Create Category'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}