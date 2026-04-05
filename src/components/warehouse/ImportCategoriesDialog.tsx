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
import { 
  Package, FileText, Hammer, Download, Factory, Monitor, Car, 
  UtensilsCrossed, HeartPulse, Hotel, Sprout, Truck, Warehouse 
} from 'lucide-react';
import { STANDARD_INDUSTRY_TEMPLATES, StandardCategory } from '@/constants/standardCategories';
import { useItemCategories } from '@/hooks/useItemCategories';
import { CreateItemCategoryData } from '@/types/itemBin';

interface ImportCategoriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId?: string;
}

export function ImportCategoriesDialog({ open, onOpenChange, companyId }: ImportCategoriesDialogProps) {
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [selectedIndustry, setSelectedIndustry] = useState<string>('Apparel');
  
  const { categories: existingCategories, bulkImportCategories, isImporting } = useItemCategories(companyId);

  const existingCategoryNames = useMemo(() => {
    return new Set(existingCategories.map(cat => cat.name.toLowerCase()));
  }, [existingCategories]);

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

    const categoriesToImport = availableCategories
      .filter(cat => selectedCategories.has(cat.uniqueKey))
      .sort((a, b) => a.level - b.level)
      .map(category => ({
        name: category.name,
        code: category.code,
        description: category.description,
        level: category.level,
        parentName: category.parentName,
        company_id: companyId
      }));

    bulkImportCategories(categoriesToImport);
    onOpenChange(false);
    setSelectedCategories(new Set());
  };

  const INDUSTRY_ICONS: Record<string, React.ReactNode> = {
    'Apparel': <Package className="h-4 w-4 shrink-0" />,
    'Construction': <Hammer className="h-4 w-4 shrink-0" />,
    'Stationery': <FileText className="h-4 w-4 shrink-0" />,
    'Manufacturing': <Factory className="h-4 w-4 shrink-0" />,
    'IT & Electronics': <Monitor className="h-4 w-4 shrink-0" />,
    'Automotive': <Car className="h-4 w-4 shrink-0" />,
    'Food & Beverage': <UtensilsCrossed className="h-4 w-4 shrink-0" />,
    'Healthcare': <HeartPulse className="h-4 w-4 shrink-0" />,
    'Hospitality': <Hotel className="h-4 w-4 shrink-0" />,
    'Agriculture': <Sprout className="h-4 w-4 shrink-0" />,
    'Logistics': <Truck className="h-4 w-4 shrink-0" />,
    'General': <Warehouse className="h-4 w-4 shrink-0" />,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
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
          <ScrollArea className="w-full">
            <TabsList className="inline-flex w-max gap-1 p-1">
              {STANDARD_INDUSTRY_TEMPLATES.map((template) => (
                <TabsTrigger 
                  key={template.name} 
                  value={template.name}
                  className="flex items-center gap-1.5 whitespace-nowrap text-xs px-3"
                >
                  {INDUSTRY_ICONS[template.name] || <Package className="h-4 w-4 shrink-0" />}
                  {template.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </ScrollArea>

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
                        className={`flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50`}
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
