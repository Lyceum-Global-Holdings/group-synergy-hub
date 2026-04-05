import { useState, useEffect, useMemo } from 'react';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import { useItemCategories } from '@/hooks/useItemCategories';
import { ItemCategory } from '@/types/itemBin';

/**
 * Generate a 3-letter mnemonic code from a category name (ISO 7372 / SAP MM aligned).
 * Primary rule: first 3 consonants, uppercased.
 * Fallback: first 3 letters if fewer than 3 consonants.
 * Collision: increment last character until unique.
 */
function generateCategoryCode(name: string, existingCodes: string[]): string {
  if (!name.trim()) return '';

  const cleaned = name.trim().toUpperCase();
  const consonants = cleaned.replace(/[^BCDFGHJKLMNPQRSTVWXYZ]/g, '');
  
  let base: string;
  if (consonants.length >= 3) {
    base = consonants.slice(0, 3);
  } else {
    // Fallback: use first 3 alpha characters
    const alphas = cleaned.replace(/[^A-Z]/g, '');
    base = alphas.slice(0, 3).padEnd(3, 'X');
  }

  // Check collisions among siblings
  let candidate = base;
  const existingSet = new Set(existingCodes.map(c => c.toUpperCase()));
  let attempts = 0;
  while (existingSet.has(candidate) && attempts < 26) {
    // Increment last character
    const lastChar = candidate.charCodeAt(2);
    const nextChar = lastChar >= 90 ? 65 : lastChar + 1; // Wrap Z -> A
    candidate = candidate.slice(0, 2) + String.fromCharCode(nextChar);
    attempts++;
  }

  return candidate;
}

interface CreateCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingCategory?: ItemCategory | null;
  companyId?: string;
}

export function CreateCategoryDialog({ open, onOpenChange, editingCategory, companyId }: CreateCategoryDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    parent_id: 'none'
  });
  const [codeManuallyEdited, setCodeManuallyEdited] = useState(false);
  const [codeError, setCodeError] = useState('');

  const { categories, createCategory, isCreating } = useItemCategories(companyId);

  // Get sibling codes for collision detection
  const siblingCodes = useMemo(() => {
    const parentId = formData.parent_id === 'none' ? null : formData.parent_id;
    return categories
      .filter(cat => cat.parent_id === parentId && cat.id !== editingCategory?.id)
      .map(cat => {
        const code = cat.code || '';
        // For sub-categories, extract the last segment after the last hyphen
        if (parentId && code.includes('-')) {
          return code.split('-').pop() || '';
        }
        return code;
      })
      .filter(Boolean);
  }, [categories, formData.parent_id, editingCategory?.id]);

  // Get parent code for sub-category prefix
  const parentCode = useMemo(() => {
    if (formData.parent_id === 'none' || !formData.parent_id) return '';
    const parent = categories.find(c => c.id === formData.parent_id);
    return parent?.code || '';
  }, [categories, formData.parent_id]);

  // Auto-generate code when name changes (only if not manually edited)
  useEffect(() => {
    if (editingCategory || codeManuallyEdited) return;
    if (!formData.name.trim()) {
      setFormData(prev => ({ ...prev, code: '' }));
      return;
    }

    const rawCode = generateCategoryCode(formData.name, siblingCodes);
    const fullCode = parentCode ? `${parentCode}-${rawCode}` : rawCode;
    setFormData(prev => ({ ...prev, code: fullCode }));
  }, [formData.name, formData.parent_id, siblingCodes, parentCode, editingCategory, codeManuallyEdited]);

  // Validate code
  useEffect(() => {
    if (!formData.code) {
      setCodeError('');
      return;
    }
    // Extract the leaf code (last segment)
    const leafCode = formData.code.includes('-') 
      ? formData.code.split('-').pop() || '' 
      : formData.code;
    
    if (!/^[A-Z]{3}$/.test(leafCode)) {
      setCodeError('Code must be exactly 3 uppercase letters (per segment)');
    } else {
      setCodeError('');
    }
  }, [formData.code]);

  useEffect(() => {
    if (editingCategory) {
      setFormData({
        name: editingCategory.name,
        code: editingCategory.code || '',
        description: editingCategory.description || '',
        parent_id: editingCategory.parent_id || 'none'
      });
      setCodeManuallyEdited(true); // Preserve existing code when editing
    } else {
      setFormData({
        name: '',
        code: '',
        description: '',
        parent_id: 'none'
      });
      setCodeManuallyEdited(false);
    }
  }, [editingCategory, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (codeError) return;

    const categoryData = {
      name: formData.name,
      code: formData.code || null,
      description: formData.description || null,
      parent_id: formData.parent_id === "none" ? null : formData.parent_id || null,
      company_id: companyId || null
    };

    createCategory(categoryData);
    onOpenChange(false);
  };

  const handleChange = (field: string, value: string) => {
    if (field === 'code') {
      setCodeManuallyEdited(true);
      value = value.toUpperCase();
    }
    if (field === 'parent_id') {
      // Reset manual edit flag when parent changes so code regenerates
      setCodeManuallyEdited(false);
    }
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Filter out the current category from parent options to prevent circular references
  const availableParentCategories = categories.filter(cat => cat.id !== editingCategory?.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
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
              <div className="flex items-center gap-1">
                <Label htmlFor="code">Category Code</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[250px]">
                      <p className="text-xs">Auto-generated 3-letter code based on ISO 7372 / UNSPSC standards. Sub-categories use parent prefix (e.g., ELC-CMP).</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => handleChange('code', e.target.value)}
                placeholder="Auto-generated"
                className={codeError ? 'border-destructive' : ''}
                readOnly={!editingCategory && !codeManuallyEdited && !!formData.code}
              />
              {codeError && (
                <p className="text-xs text-destructive">{codeError}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="parent_id">Parent Category</Label>
            <Select value={formData.parent_id} onValueChange={(value) => handleChange('parent_id', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select parent category (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (Top Level)</SelectItem>
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