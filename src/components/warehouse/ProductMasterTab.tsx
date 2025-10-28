import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit, Trash2, Eye, Sparkles } from "lucide-react";
import { useProductMaster, ProductMaster, calculateTotalVariants } from "@/hooks/useProductMaster";
import { useCompany } from "@/contexts/CompanyContext";
import { CreateProductMasterDialog } from "./CreateProductMasterDialog";
import { ProductMasterDetailsDialog } from "./ProductMasterDetailsDialog";
import { EditProductMasterDialog } from "./EditProductMasterDialog";
import { BulkGenerateVariantsDialog } from "./BulkGenerateVariantsDialog";
import { Skeleton } from "@/components/ui/skeleton";

export function ProductMasterTab() {
  const [searchTerm, setSearchTerm] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductMaster | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const { selectedCompany } = useCompany();
  const { products, isLoading, deleteProduct, variantCounts } = useProductMaster(selectedCompany?.id);

  const filteredProducts = products?.filter((product) =>
    product.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.product_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.style_no?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleView = (product: ProductMaster) => {
    setSelectedProduct(product);
    setDetailsDialogOpen(true);
  };

  const handleEdit = (product: ProductMaster) => {
    setSelectedProduct(product);
    setEditDialogOpen(true);
  };

  const handleDelete = (id: string, productName: string) => {
    if (window.confirm(`Are you sure you want to delete "${productName}"? This will not affect existing finished goods.`)) {
      deleteProduct(id);
    }
  };

  const handleGenerateVariants = (product: ProductMaster) => {
    setSelectedProduct(product);
    setGenerateDialogOpen(true);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Product Master</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Product Master</CardTitle>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Product Master
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by product name, code, or style no..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
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
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts && filteredProducts.length > 0 ? (
                  filteredProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.product_code}</TableCell>
                      <TableCell>{product.product_name}</TableCell>
                      <TableCell>{product.style_no || "-"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {product.available_colors?.slice(0, 3).map((color: any, idx: number) => (
                            <div
                              key={idx}
                              className="w-6 h-6 rounded border"
                              style={{ backgroundColor: color.color_code }}
                              title={color.color_name}
                            />
                          ))}
                          {product.available_colors?.length > 3 && (
                            <Badge variant="secondary">+{product.available_colors.length - 3}</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {product.available_sizes?.slice(0, 3).map((size, idx) => (
                            <Badge key={idx} variant="outline">{size}</Badge>
                          ))}
                          {product.available_sizes?.length > 3 && (
                            <Badge variant="secondary">+{product.available_sizes.length - 3}</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={product.status === 'active' ? 'default' : 'secondary'}>
                          {product.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {(() => {
                            const existingVariants = variantCounts?.[product.id] || 0;
                            const totalPossible = calculateTotalVariants(product);
                            
                            // Only render the button if there are missing variants
                            if (existingVariants < totalPossible) {
                              return (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title={`Generate Variants (${existingVariants}/${totalPossible} created)`}
                                  onClick={() => handleGenerateVariants(product)}
                                >
                                  <Sparkles className="h-4 w-4" />
                                </Button>
                              );
                            }
                            return null;
                          })()}
                          <Button
                            variant="ghost"
                            size="icon"
                            title="View Details"
                            onClick={() => handleView(product)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Edit"
                            onClick={() => handleEdit(product)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Delete"
                            onClick={() => handleDelete(product.id, product.product_name)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      {searchTerm ? "No products found matching your search." : "No product masters yet. Create one to get started."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>

      <CreateProductMasterDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      {selectedProduct && (
        <>
          <ProductMasterDetailsDialog
            product={selectedProduct}
            open={detailsDialogOpen}
            onOpenChange={setDetailsDialogOpen}
          />
          
          <EditProductMasterDialog
            product={selectedProduct}
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
          />
        </>
      )}

      <BulkGenerateVariantsDialog
        productMaster={selectedProduct}
        open={generateDialogOpen}
        onOpenChange={setGenerateDialogOpen}
      />
    </Card>
  );
}
