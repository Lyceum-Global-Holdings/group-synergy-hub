import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProductMaster, ProductMaster } from "@/hooks/useProductMaster";
import { useCompany } from "@/contexts/CompanyContext";
import { useItemCategories } from "@/hooks/useItemCategories";
import { MultiColorSelector } from "./MultiColorSelector";
import { MultiSizeSelector } from "@/components/common/MultiSizeSelector";

interface EditProductMasterDialogProps {
  product: ProductMaster;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditProductMasterDialog({ product, open, onOpenChange }: EditProductMasterDialogProps) {
  const [productName, setProductName] = useState("");
  const [productCode, setProductCode] = useState("");
  const [styleNo, setStyleNo] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [selectedColors, setSelectedColors] = useState<any[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [unitOfMeasure, setUnitOfMeasure] = useState("pcs");
  const [status, setStatus] = useState("active");

  const { selectedCompany } = useCompany();
  const { updateProduct, isUpdating } = useProductMaster(selectedCompany?.id);
  const { categories } = useItemCategories();

  // Filter for apparel categories
  const apparelCategories = categories?.filter(cat => 
    cat.name.toLowerCase().includes('apparel') || 
    cat.name.toLowerCase().includes('garment') ||
    cat.name.toLowerCase().includes('clothing')
  ) || [];

  // Initialize form with product data when dialog opens
  useEffect(() => {
    if (open && product) {
      setProductName(product.product_name);
      setProductCode(product.product_code);
      setStyleNo(product.style_no || "");
      setCategoryId(product.category_id || "");
      setDescription(product.description || "");
      setSelectedColors(product.available_colors || []);
      setSelectedSizes(product.available_sizes || []);
      setUnitOfMeasure(product.unit_of_measure);
      setStatus(product.status);
    }
  }, [open, product]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!productName.trim() || !productCode.trim()) {
      return;
    }

    updateProduct(
      {
        id: product.id,
        data: {
          product_name: productName.trim(),
          product_code: productCode.trim(),
          style_no: styleNo.trim() || undefined,
          category_id: categoryId || undefined,
          description: description.trim() || undefined,
          available_colors: selectedColors,
          available_sizes: selectedSizes,
          unit_of_measure: unitOfMeasure,
          status,
        },
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Product Master</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="productName">Product Name *</Label>
              <Input
                id="productName"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="e.g., Cotton T-Shirt"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="productCode">Product Code *</Label>
              <Input
                id="productCode"
                value={productCode}
                onChange={(e) => setProductCode(e.target.value)}
                placeholder="e.g., TSHIRT001"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="styleNo">Style No</Label>
              <Input
                id="styleNo"
                value={styleNo}
                onChange={(e) => setStyleNo(e.target.value)}
                placeholder="e.g., ST-2024-001"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {apparelCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Product description..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Available Colors</Label>
            <MultiColorSelector
              selectedColors={selectedColors}
              onColorsChange={setSelectedColors}
            />
          </div>

          <div className="space-y-2">
            <Label>Available Sizes</Label>
              <MultiSizeSelector
                selectedSizes={selectedSizes}
                onSizesChange={setSelectedSizes}
                groupByCategory={true}
                showSelectAll={true}
                categories={['Apparel', 'Numeric']}
              />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="uom">Unit of Measure</Label>
              <Select value={unitOfMeasure} onValueChange={setUnitOfMeasure}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pcs">Pieces (pcs)</SelectItem>
                  <SelectItem value="box">Box</SelectItem>
                  <SelectItem value="dozen">Dozen</SelectItem>
                  <SelectItem value="set">Set</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="discontinued">Discontinued</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isUpdating}>
              {isUpdating ? "Updating..." : "Update Product"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
