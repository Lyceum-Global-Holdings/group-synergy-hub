import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAssetMaster } from "@/hooks/useAssetMaster";
import { useAssetCategories } from "@/hooks/useAssetCategories";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Upload, Info } from "lucide-react";
import { CreateAssetMasterData } from "@/types/assetMaster";
import { calculateDepreciation } from "@/lib/depreciationCalculator";
import { Alert, AlertDescription } from "@/components/ui/alert";

const formSchema = z.object({
  asset_name: z.string().min(1, "Asset name is required"),
  brand: z.string().optional(),
  category_id: z.string().optional(),
  subcategory_id: z.string().optional(),
  purchase_price: z.coerce.number().optional(),
  current_value: z.coerce.number().optional(),
  description: z.string().optional(),
  depreciation_method: z.enum(['straight_line', 'declining_balance']).optional(),
  depreciation_rate: z.coerce.number().min(0).max(100).optional(),
  useful_life_years: z.coerce.number().min(0).optional(),
  salvage_value: z.coerce.number().min(0).optional(),
  purchase_date: z.string().optional(),
});

interface CreateAssetMasterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateAssetMasterDialog({ open, onOpenChange }: CreateAssetMasterDialogProps) {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const { createAssetMaster, isCreating } = useAssetMaster();
  const { categories, mainCategories, getSubcategories } = useAssetCategories();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      asset_name: "",
      brand: "",
      category_id: "",
      subcategory_id: "",
      purchase_price: undefined,
      current_value: undefined,
      description: "",
      depreciation_method: "straight_line",
      depreciation_rate: undefined,
      useful_life_years: undefined,
      salvage_value: 0,
      purchase_date: "",
    },
  });

  const selectedCategoryId = form.watch("category_id");
  const subcategories = selectedCategoryId ? getSubcategories(selectedCategoryId) : [];
  
  const purchasePrice = form.watch("purchase_price");
  const purchaseDate = form.watch("purchase_date");
  const depreciationMethod = form.watch("depreciation_method");
  const depreciationRate = form.watch("depreciation_rate");
  const usefulLifeYears = form.watch("useful_life_years");
  const salvageValue = form.watch("salvage_value");

  const estimatedCurrentValue = purchasePrice && purchaseDate && depreciationMethod
    ? calculateDepreciation({
        purchasePrice,
        purchaseDate: new Date(purchaseDate),
        depreciationMethod,
        depreciationRate,
        usefulLifeYears,
        salvageValue,
      }).currentValue
    : null;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return null;

    setUploading(true);
    try {
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('asset-images')
        .upload(filePath, imageFile);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('asset-images')
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: "Error",
        description: "Failed to upload image",
        variant: "destructive",
      });
      return null;
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const imageUrl = await uploadImage();

    const assetData: CreateAssetMasterData = {
      asset_name: values.asset_name,
      brand: values.brand,
      category_id: values.category_id,
      subcategory_id: values.subcategory_id,
      purchase_price: values.purchase_price,
      current_value: values.current_value,
      description: values.description,
      image_url: imageUrl || undefined,
      depreciation_method: values.depreciation_method,
      depreciation_rate: values.depreciation_rate,
      useful_life_years: values.useful_life_years,
      salvage_value: values.salvage_value,
      purchase_date: values.purchase_date?.trim() || undefined,
    };

    createAssetMaster(assetData);

    form.reset();
    setImageFile(null);
    setImagePreview(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Asset Master Item</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="asset_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Asset Name *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Enter asset name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="brand"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Brand</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Enter brand" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="category_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {mainCategories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="subcategory_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sub Category</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value}
                      disabled={!selectedCategoryId || subcategories.length === 0}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select subcategory" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {subcategories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="purchase_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Purchase Price *</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} placeholder="0.00" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="purchase_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Purchase Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} max={new Date().toISOString().split('T')[0]} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4 p-4 border rounded-lg">
              <h3 className="font-semibold">Depreciation Settings</h3>
              
              <FormField
                control={form.control}
                name="depreciation_method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Depreciation Method</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select method" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="straight_line">Straight Line</SelectItem>
                        <SelectItem value="declining_balance">Declining Balance</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {depreciationMethod === 'straight_line' && (
                <FormField
                  control={form.control}
                  name="useful_life_years"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Useful Life (Years) *</FormLabel>
                      <FormControl>
                        <Input type="number" step="1" min="1" {...field} placeholder="e.g., 5" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {depreciationMethod === 'declining_balance' && (
                <FormField
                  control={form.control}
                  name="depreciation_rate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Depreciation Rate (%) *</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="0" max="100" {...field} placeholder="e.g., 20" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="salvage_value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Salvage Value (Optional)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" {...field} placeholder="0.00" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {estimatedCurrentValue !== null && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <span className="font-semibold">Estimated Current Value: </span>
                    LKR {estimatedCurrentValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <div>
              <FormLabel>Product Image</FormLabel>
              <div className="mt-2 flex items-center gap-4">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                  id="image-upload"
                />
                <label htmlFor="image-upload">
                  <Button type="button" variant="outline" asChild>
                    <span>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Image
                    </span>
                  </Button>
                </label>
                {imagePreview && (
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="h-20 w-20 object-cover rounded"
                  />
                )}
              </div>
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Enter description" rows={4} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isCreating || uploading}>
                {isCreating || uploading ? "Creating..." : "Create"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
