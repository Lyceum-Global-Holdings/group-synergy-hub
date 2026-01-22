import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateInventoryMaster, useUpdateInventoryMaster, useInventoryMaster } from "@/hooks/construction/useInventoryMaster";
import type { InventoryMaster, CreateInventoryMasterData } from "@/types/construction";
import { useEffect, useState, useRef, useMemo } from "react";
import { X, Image as ImageIcon, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Predefined Section values
const INVENTORY_SECTIONS = [
  { value: "civil", label: "Civil" },
  { value: "mechanical", label: "Mechanical" },
  { value: "carpenter", label: "Carpenter" },
  { value: "mep", label: "MEP" },
  { value: "aluminium", label: "Aluminium" },
];

// Predefined Category values
const INVENTORY_CATEGORIES = [
  { value: "machines", label: "Machines" },
  { value: "tools", label: "Tools" },
  { value: "equipments", label: "Equipments" },
  { value: "scaffolding", label: "Scaffolding" },
  { value: "materials", label: "Materials" },
  { value: "safety", label: "Safety" },
];

// Item Master schema - only item definition fields, no stock fields
const formSchema = z.object({
  item_code: z.string().optional(),
  item_name: z.string().min(1, "Item name is required"),
  serial_number: z.string().optional(),
  section: z.string().min(1, "Section is required"),
  category: z.string().min(1, "Item category is required"),
  description: z.string().optional(),
  notes: z.string().optional(),
  status: z.string().default("active"),
  image_url: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface InventoryMasterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: InventoryMaster | null;
  presetCategory?: string | null;
}

export function InventoryMasterDialog({ open, onOpenChange, item, presetCategory }: InventoryMasterDialogProps) {
  const createMutation = useCreateInventoryMaster();
  const updateMutation = useUpdateInventoryMaster();
  const { data: inventoryMaster = [] } = useInventoryMaster();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // Get existing item names for duplicate check (excluding current item when editing)
  const existingItemNames = useMemo(() => {
    return new Set(
      inventoryMaster
        .filter((i) => !item || i.id !== item.id) // Exclude current item when editing
        .map((i) => i.item_name.toLowerCase().trim())
    );
  }, [inventoryMaster, item]);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      item_code: "",
      item_name: "",
      serial_number: "",
      section: "",
      category: "",
      description: "",
      notes: "",
      status: "active",
      image_url: "",
    },
  });

  useEffect(() => {
    if (item) {
      form.reset({
        item_code: item.item_code || "",
        item_name: item.item_name,
        serial_number: item.serial_number || "",
        section: item.section || "",
        category: item.category || "",
        description: item.description || "",
        notes: item.notes || "",
        status: item.status,
        image_url: item.image_url || "",
      });
      setImagePreview(item.image_url || null);
      setDuplicateWarning(null);
    } else {
      form.reset({
        item_code: "",
        item_name: "",
        serial_number: "",
        section: "",
        category: presetCategory || "",
        description: "",
        notes: "",
        status: "active",
        image_url: "",
      });
      setImagePreview(null);
      setDuplicateWarning(null);
    }
  }, [item, form, presetCategory]);

  // Check for duplicate item name
  const checkDuplicateName = (name: string) => {
    const normalizedName = name.toLowerCase().trim();
    if (existingItemNames.has(normalizedName)) {
      setDuplicateWarning(`Item "${name}" already exists. Use Allocation View to add stock to existing items.`);
      return true;
    }
    setDuplicateWarning(null);
    return false;
  };

  const handleItemNameChange = (value: string) => {
    form.setValue("item_name", value);
    checkDuplicateName(value);
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a JPG, JPEG, or PNG image",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `inventory-items/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("construction-assets")
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from("construction-assets")
        .getPublicUrl(filePath);

      form.setValue("image_url", publicUrl);
      setImagePreview(publicUrl);
      toast({ title: "Image uploaded successfully" });
    } catch (error: any) {
      toast({
        title: "Error uploading image",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = () => {
    form.setValue("image_url", "");
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const onSubmit = async (data: FormData) => {
    // Check for duplicates before creating (not when editing)
    if (!item && checkDuplicateName(data.item_name)) {
      toast({
        title: "Duplicate item name",
        description: "This item already exists. Use Allocation View to add stock to existing items.",
        variant: "destructive",
      });
      return;
    }

    if (item) {
      await updateMutation.mutateAsync({ id: item.id, ...data });
    } else {
      await createMutation.mutateAsync(data as CreateInventoryMasterData);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? "Edit Inventory Item" : "Add New Item to Item Master"}</DialogTitle>
          {!item && (
            <DialogDescription>
              Create a new item in Item Master. To add stock to existing items, use the "Add Stock" button in Allocation View.
            </DialogDescription>
          )}
        </DialogHeader>
        
        {/* Duplicate Warning */}
        {duplicateWarning && !item && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{duplicateWarning}</AlertDescription>
          </Alert>
        )}
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Item Code and Item Name */}
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="item_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Item ID</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g., MAC001" 
                        {...field}
                        className="font-mono"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="item_name"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Item Name *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter item name" 
                        {...field}
                        onChange={(e) => handleItemNameChange(e.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Serial Number */}
            <FormField
              control={form.control}
              name="serial_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Serial Number</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Enter serial number (optional)" 
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Section and Category */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="section"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Section *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select section" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {INVENTORY_SECTIONS.map((section) => (
                          <SelectItem key={section.value} value={section.value}>
                            {section.label}
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
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Item Category *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {INVENTORY_CATEGORIES.map((category) => (
                          <SelectItem key={category.value} value={category.value}>
                            {category.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>


            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Enter item description" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Enter additional notes (optional)" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Image Upload */}
            <FormField
              control={form.control}
              name="image_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Add Image</FormLabel>
                  <FormControl>
                    <div className="space-y-3">
                      {imagePreview ? (
                        <div className="relative inline-block">
                          <img
                            src={imagePreview}
                            alt="Item preview"
                            className="w-24 h-24 object-cover rounded-lg border"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute -top-2 -right-2 h-6 w-6"
                            onClick={handleRemoveImage}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div
                          className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          {isUploading ? (
                            <div className="flex items-center justify-center gap-2">
                              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                              <span className="text-sm text-muted-foreground">Uploading...</span>
                            </div>
                          ) : (
                            <>
                              <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                              <p className="text-sm text-muted-foreground">
                                Click to upload image
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                JPG, JPEG, PNG (max 5MB)
                              </p>
                            </>
                          )}
                        </div>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".jpg,.jpeg,.png"
                        className="hidden"
                        onChange={handleImageUpload}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Status */}
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {item ? "Update" : "Add"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
