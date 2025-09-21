import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Plus, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useBillOfMaterials } from '@/hooks/useBillOfMaterials';
import { useCompany } from '@/contexts/CompanyContext';
import { BOM_CATEGORIES, BomCategoryKey } from '@/constants/bomCategories';
import { STANDARD_SIZES, SIZE_CATEGORIES, getSizesByCategory } from '@/constants/standardSizes';
import { CreateBomItemData } from '@/types/bom';

const bomSchema = z.object({
  product_name: z.string().min(1, 'Product name is required'),
  version: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(['active', 'inactive', 'draft']).default('draft'),
});

type BomFormData = z.infer<typeof bomSchema>;

interface CreateBomDialogProps {
  children: React.ReactNode;
}

export function CreateBomDialog({ children }: CreateBomDialogProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Record<BomCategoryKey, CreateBomItemData[]>>({
    fabric: [],
    sewing_trims: [],
    packing_trims: [],
    embellishment: [],
  });

  const { selectedCompany } = useCompany();
  const { createBom, isCreating } = useBillOfMaterials(selectedCompany?.id);

  const form = useForm<BomFormData>({
    resolver: zodResolver(bomSchema),
    defaultValues: {
      product_name: '',
      version: '1.0',
      description: '',
      status: 'draft',
    },
  });

  const initializeCategory = (category: BomCategoryKey) => {
    if (items[category].length === 0) {
      const categoryItems = BOM_CATEGORIES[category].items.map(item => ({
        ...item,
        description: '',
        quantity: 0,
        unit_cost: 0,
        consumption: 0,
        category,
        item_code: '',
        colour: '',
        size: '',
      }));
      setItems(prev => ({ ...prev, [category]: categoryItems }));
    }
  };

  const addItem = (category: BomCategoryKey) => {
    const newItem: CreateBomItemData = {
      item_name: '',
      description: '',
      quantity: 0,
      unit_of_measure: 'pcs',
      unit_cost: 0,
      consumption: 0,
      category,
      item_code: '',
      colour: '',
      size: '',
    };
    setItems(prev => ({
      ...prev,
      [category]: [...prev[category], newItem]
    }));
  };

  const removeItem = (category: BomCategoryKey, index: number) => {
    setItems(prev => ({
      ...prev,
      [category]: prev[category].filter((_, i) => i !== index)
    }));
  };

  const updateItem = (category: BomCategoryKey, index: number, field: keyof CreateBomItemData, value: any) => {
    setItems(prev => ({
      ...prev,
      [category]: prev[category].map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const onSubmit = async (data: BomFormData) => {
    try {
      const allItems = Object.values(items).flat().filter(item => 
        item.item_name.trim() !== '' && item.quantity > 0
      );

      await createBom({
        product_name: data.product_name,
        version: data.version,
        description: data.description,
        status: data.status,
        company_id: selectedCompany?.id,
        items: allItems,
      });

      setOpen(false);
      form.reset();
      setItems({
        fabric: [],
        sewing_trims: [],
        packing_trims: [],
        embellishment: [],
      });
    } catch (error) {
      console.error('Error creating BOM:', error);
    }
  };

  const renderItemsTable = (category: BomCategoryKey) => {
    const categoryItems = items[category];
    
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium">{BOM_CATEGORIES[category].label}</h3>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => initializeCategory(category)}
            >
              Load Template
            </Button>
            <Button
              type="button"
              variant="outline" 
              size="sm"
              onClick={() => addItem(category)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Item
            </Button>
          </div>
        </div>

        {categoryItems.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-2 text-left font-medium">Item Code</th>
                    <th className="p-2 text-left font-medium">Description</th>
                    <th className="p-2 text-left font-medium">Colour</th>
                    <th className="p-2 text-left font-medium">Size</th>
                    <th className="p-2 text-left font-medium">Consumption</th>
                    <th className="p-2 text-left font-medium">UOM</th>
                    <th className="p-2 text-left font-medium">Qty</th>
                    <th className="p-2 text-left font-medium">Unit Cost</th>
                    <th className="p-2 text-left font-medium">Total</th>
                    <th className="p-2 text-center font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryItems.map((item, index) => (
                    <tr key={index} className="border-t">
                      <td className="p-2">
                        <Input
                          value={item.item_code || ''}
                          onChange={(e) => updateItem(category, index, 'item_code', e.target.value)}
                          placeholder="Item code"
                          className="h-8"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          value={item.item_name}
                          onChange={(e) => updateItem(category, index, 'item_name', e.target.value)}
                          placeholder="Description"
                          className="h-8 min-w-[150px]"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          value={item.colour || ''}
                          onChange={(e) => updateItem(category, index, 'colour', e.target.value)}
                          placeholder="Colour"
                          className="h-8"
                        />
                      </td>
                      <td className="p-2">
                        <Select
                          value={item.size || ''}
                          onValueChange={(value) => updateItem(category, index, 'size', value)}
                        >
                          <SelectTrigger className="h-8 w-24">
                            <SelectValue placeholder="Size" />
                          </SelectTrigger>
                          <SelectContent className="bg-background border z-50 max-h-60">
                            {SIZE_CATEGORIES.map((cat) => (
                              <div key={cat}>
                                <div className="px-2 py-1 text-xs font-medium text-muted-foreground border-b">
                                  {cat}
                                </div>
                                {getSizesByCategory(cat).map((size) => (
                                  <SelectItem key={size.value} value={size.value}>
                                    {size.label}
                                  </SelectItem>
                                ))}
                              </div>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          value={item.consumption || ''}
                          onChange={(e) => updateItem(category, index, 'consumption', parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          className="h-8 w-20"
                          step="0.01"
                        />
                      </td>
                      <td className="p-2">
                        <Select
                          value={item.unit_of_measure}
                          onValueChange={(value) => updateItem(category, index, 'unit_of_measure', value)}
                        >
                          <SelectTrigger className="h-8 w-20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pcs">pcs</SelectItem>
                            <SelectItem value="mtr">mtr</SelectItem>
                            <SelectItem value="kg">kg</SelectItem>
                            <SelectItem value="cone">cone</SelectItem>
                            <SelectItem value="yard">yard</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItem(category, index, 'quantity', parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          className="h-8 w-20"
                          step="0.01"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          value={item.unit_cost || ''}
                          onChange={(e) => updateItem(category, index, 'unit_cost', parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                          className="h-8 w-24"
                          step="0.01"
                        />
                      </td>
                      <td className="p-2 text-right font-medium">
                        {((item.unit_cost || 0) * item.quantity).toFixed(2)}
                      </td>
                      <td className="p-2 text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(category, index)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive-foreground hover:bg-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Bill of Materials</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>BOM Information</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="product_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product Name *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter product name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="version"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Version</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="1.0" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Enter BOM description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>BOM Items</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="fabric" className="w-full">
                  <TabsList className="grid w-full grid-cols-4">
                    {Object.entries(BOM_CATEGORIES).map(([key, category]) => (
                      <TabsTrigger key={key} value={key}>
                        {category.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  
                  {Object.entries(BOM_CATEGORIES).map(([key]) => (
                    <TabsContent key={key} value={key} className="mt-6">
                      {renderItemsTable(key as BomCategoryKey)}
                    </TabsContent>
                  ))}
                </Tabs>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? 'Creating...' : 'Create BOM'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}