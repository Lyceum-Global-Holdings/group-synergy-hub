import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Package, FileText, Hammer, Download } from 'lucide-react';
import { STANDARD_INDUSTRY_TEMPLATES, StandardCategory } from '@/constants/standardCategories';
import { useItemCategories } from '@/hooks/useItemCategories';
import { CreateItemCategoryData } from '@/types/itemBin';

interface ImportCategoriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportCategoriesDialog({ open, onOpenChange }: ImportCategoriesDialogProps) {
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [selectedIndustry, setSelectedIndustry] = useState<string>('Apparel');
  
  const { categories: existingCategories, bulkImportCategories, isImporting } = useItemCategories();

  // Get existing category names to prevent duplicates
  const existingCategoryNames = useMemo(() => {
    return new Set(existingCategories.map(cat => cat.name.toLowerCase()));
  }, [existingCategories]);

  // Flatten categories for easier processing
  const flattenCategories = (categories: StandardCategory[], parentId?: string): Array<StandardCategory & { parentName?: string; level: number; uniqueKey: string }> => {
    const result: Array<StandardCategory & { parentName?: string; level: number; uniqueKey: string }> = [];
    
    categories.forEach(category => {
      const categoryWithMeta = { 
        ...category, 
        parentName: parentId, 
        level: parentId ? 1 : 0,
        uniqueKey: parentId ? `${parentId}-${category.name}` : category.name
      };
      result.push(categoryWithMeta);
      
      if (category.subcategories) {
        result.push(...flattenCategories(category.subcategories, category.name).map(sub => ({
          ...sub,
          level: sub.level + 1
        })));
      }
    });
    
    return result;
  };

  const currentIndustryTemplate = STANDARD_INDUSTRY_TEMPLATES.find(t => t.name === selectedIndustry);
  const flatCategories = currentIndustryTemplate ? flattenCategories(currentIndustryTemplate.categories) : [];

  // Filter out categories that already exist
  const availableCategories = flatCategories.filter(cat => 
    !existingCategoryNames.has(cat.name.toLowerCase())
  );

  const handleCategoryToggle = (categoryKey: string) => {
    const newSelected = new Set(selectedCategories);
    if (newSelected.has(categoryKey)) {
      newSelected.delete(categoryKey);
    } else {
      newSelected.add(categoryKey);
    }
    setSelectedCategories(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedCategories.size === availableCategories.length) {
      setSelectedCategories(new Set());
    } else {
      setSelectedCategories(new Set(availableCategories.map(cat => cat.uniqueKey)));
    }
  };

  const handleImport = () => {
    if (selectedCategories.size === 0) return;

    // Create a map for parent categories
    const parentMap = new Map<string, string>();
    const categoriesToImport: CreateItemCategoryData[] = [];
    
    // Process selected categories in order (parents first)
    const sortedCategories = availableCategories
      .filter(cat => selectedCategories.has(cat.uniqueKey))
      .sort((a, b) => a.level - b.level);

    sortedCategories.forEach(category => {
      let parent_id: string | undefined;
      
      // Find parent ID if this is a subcategory
      if (category.parentName) {
        parent_id = parentMap.get(category.parentName);
      }

      const categoryData: CreateItemCategoryData = {
        name: category.name,
        code: category.code,
        description: category.description,
        parent_id
      };

      categoriesToImport.push(categoryData);
      
      // Store this category for future children
      parentMap.set(category.name, 'pending'); // Will be replaced with actual ID after creation
    });

    bulkImportCategories(categoriesToImport);
    onOpenChange(false);
    setSelectedCategories(new Set());
  };

  const getIndustryIcon = (industry: string) => {
    switch (industry) {
      case 'Apparel': return <Package className="h-4 w-4" />;
      case 'Construction': return <Hammer className="h-4 w-4" />;
      case 'Stationery': return <FileText className="h-4 w-4" />;
      default: return <Package className="h-4 w-4" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Import Standard Categories
          </DialogTitle>
          <DialogDescription>
            Import predefined category templates for different industries. Select an industry and choose which categories to import.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={selectedIndustry} onValueChange={setSelectedIndustry} className="flex-1">
          <TabsList className="grid w-full grid-cols-3">
            {STANDARD_INDUSTRY_TEMPLATES.map((template) => (
              <TabsTrigger 
                key={template.name} 
                value={template.name}
                className="flex items-center gap-2"
              >
                {getIndustryIcon(template.name)}
                {template.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {STANDARD_INDUSTRY_TEMPLATES.map((template) => (
            <TabsContent key={template.name} value={template.name} className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{template.description}</p>
                  <Badge variant="secondary" className="mt-1">
                    {availableCategories.length} categories available
                  </Badge>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                >
                  {selectedCategories.size === availableCategories.length ? 'Clear All' : 'Select All'}
                </Button>
              </div>

              <ScrollArea className="h-[400px] border rounded-lg p-4">
                <div className="space-y-2">
                  {availableCategories.map((category) => {
                    const categoryKey = category.uniqueKey;
                    const isSelected = selectedCategories.has(categoryKey);
                    
                    return (
                      <div 
                        key={categoryKey}
                        className={`flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 ${
                          category.level > 0 ? 'ml-' + (category.level * 4) : ''
                        }`}
                        style={{ marginLeft: category.level * 16 }}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleCategoryToggle(categoryKey)}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{category.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {category.code}
                            </Badge>
                            {category.level > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                subcategory
                              </Badge>
                            )}
                          </div>
                          {category.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {category.description}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  
                  {availableCategories.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>All categories from this industry are already imported.</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          ))}
        </Tabs>

        <Separator />
        
        <DialogFooter>
          <div className="flex items-center justify-between w-full">
            <p className="text-sm text-muted-foreground">
              {selectedCategories.size} categories selected
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleImport}
                disabled={selectedCategories.size === 0 || isImporting}
              >
                {isImporting ? 'Importing...' : `Import ${selectedCategories.size} Categories`}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}