import { useState } from "react";
import { Plus, Eye, Edit, Trash2, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useProductMaster } from "@/hooks/useProductMaster";
import { useFinishedGoods } from "@/hooks/useFinishedGoods";
import { useApparelCategories } from "@/hooks/useApparelCategories";
import { ProductMaster } from "@/types/productMaster";
import { CreateProductMasterDialog } from "./CreateProductMasterDialog";
import { EditProductMasterDialog } from "./EditProductMasterDialog";
import { ProductMasterDetailsDialog } from "./ProductMasterDetailsDialog";
import { ColorMasterDialog } from "./ColorMasterDialog";

export function ProductMasterTab() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isColorDialogOpen, setIsColorDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductMaster | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const { productMasters = [], isLoading, deleteProductMaster } = useProductMaster();
  const { products = [] } = useFinishedGoods();
  const { apparelCategories = [] } = useApparelCategories();

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return 'N/A';
    const category = apparelCategories.find(c => c.id === categoryId);
    return category?.name || 'N/A';
  };

  const getVariantCount = (productMasterId: string) => {
    return (products || []).filter(p => p.product_master_id === productMasterId).length;
  };

  const filteredProducts = (productMasters || []).filter(product =>
    product.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.product_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.style_no?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleViewDetails = (product: ProductMaster) => {
    setSelectedProduct(product);
    setIsDetailsDialogOpen(true);
  };

  const handleEdit = (product: ProductMaster) => {
    setSelectedProduct(product);
    setIsEditDialogOpen(true);
  };

  const handleDeleteClick = (product: ProductMaster) => {
    setSelectedProduct(product);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (selectedProduct) {
      deleteProductMaster(selectedProduct.id);
      setIsDeleteDialogOpen(false);
      setSelectedProduct(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { variant: "default" as const, label: "Active" },
      inactive: { variant: "secondary" as const, label: "Inactive" },
      discontinued: { variant: "destructive" as const, label: "Discontinued" },
    };
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.active;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{productMasters.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {productMasters.filter(p => p.status === 'active').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Variants</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(products || []).filter(p => p.is_variant).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{apparelCategories.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-between items-center gap-4">
        <Input
          placeholder="Search by name, code, or style..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsColorDialogOpen(true)}>
            <Palette className="h-4 w-4 mr-2" />
            Colors
          </Button>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Product Master
          </Button>
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product Code</TableHead>
              <TableHead>Product Name</TableHead>
              <TableHead>Style No</TableHead>
              <TableHead>Colors</TableHead>
              <TableHead>Sizes</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Variants</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center">Loading...</TableCell>
              </TableRow>
            ) : filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center">No product masters found</TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.product_code}</TableCell>
                  <TableCell>{product.product_name}</TableCell>
                  <TableCell>{product.style_no || 'N/A'}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {product.available_colors.slice(0, 3).map((color) => (
                        <Badge key={color} variant="outline" className="text-xs">
                          {color}
                        </Badge>
                      ))}
                      {product.available_colors.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{product.available_colors.length - 3}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {product.available_sizes.slice(0, 3).map((size) => (
                        <Badge key={size} variant="secondary" className="text-xs">
                          {size}
                        </Badge>
                      ))}
                      {product.available_sizes.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{product.available_sizes.length - 3}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{getCategoryName(product.category_id)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{getVariantCount(product.id)}</Badge>
                  </TableCell>
                  <TableCell>{getStatusBadge(product.status)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewDetails(product)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(product)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteClick(product)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <CreateProductMasterDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />

      <ColorMasterDialog
        open={isColorDialogOpen}
        onOpenChange={setIsColorDialogOpen}
      />

      {selectedProduct && (
        <>
          <ProductMasterDetailsDialog
            productMaster={selectedProduct}
            open={isDetailsDialogOpen}
            onOpenChange={setIsDetailsDialogOpen}
          />

          <EditProductMasterDialog
            productMaster={selectedProduct}
            open={isEditDialogOpen}
            onOpenChange={setIsEditDialogOpen}
          />
        </>
      )}

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the product master "{selectedProduct?.product_name}".
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
