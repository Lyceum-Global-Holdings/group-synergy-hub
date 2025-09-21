import { useState } from "react";
import { Plus, Search, FileText, Eye, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBillOfMaterials, useDeleteBillOfMaterials } from "@/hooks/useBillOfMaterials";
import type { BillOfMaterials } from "@/types/bom";

const statusColors = {
  active: "bg-success text-success-foreground",
  inactive: "bg-muted text-muted-foreground", 
  draft: "bg-warning text-warning-foreground",
};

const statusLabels = {
  active: "Active",
  inactive: "Inactive",
  draft: "Draft",
};

export default function BillOfMaterialsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedBom, setSelectedBom] = useState<BillOfMaterials | null>(null);

  const { data: boms = [], isLoading } = useBillOfMaterials();
  const deleteBomMutation = useDeleteBillOfMaterials();

  // Filter BOMs
  const filteredBoms = boms.filter((bom) => {
    const matchesSearch = bom.bom_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         bom.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         bom.purchase_order?.po_number?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || bom.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this BOM?')) {
      await deleteBomMutation.mutateAsync(id);
    }
  };

  const getTotalCost = (bom: BillOfMaterials) => {
    return bom.items?.reduce((sum, item) => sum + (item.total_cost || 0), 0) || 0;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading BOMs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bill of Materials</h1>
          <p className="text-muted-foreground">Manage product BOMs and component breakdowns</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create BOM
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total BOMs</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{boms.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active BOMs</CardTitle>
            <FileText className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {boms.filter(bom => bom.status === 'active').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Draft BOMs</CardTitle>
            <FileText className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {boms.filter(bom => bom.status === 'draft').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Components</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {boms.length > 0 ? Math.round(boms.reduce((sum, bom) => sum + (bom.items?.length || 0), 0) / boms.length) : 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search BOMs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* BOMs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Bill of Materials ({filteredBoms.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>BOM Number</TableHead>
                <TableHead>Product Name</TableHead>
                <TableHead>PO Number</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Components</TableHead>
                <TableHead>Total Cost</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBoms.map((bom) => (
                <TableRow key={bom.id}>
                  <TableCell className="font-medium">{bom.bom_number}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{bom.product_name}</div>
                      {bom.description && (
                        <div className="text-sm text-muted-foreground">{bom.description}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {bom.purchase_order?.po_number ? (
                      <div>
                        <div className="font-medium">{bom.purchase_order.po_number}</div>
                        {bom.purchase_order.supplier?.name && (
                          <div className="text-sm text-muted-foreground">
                            {bom.purchase_order.supplier.name}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>{bom.version}</TableCell>
                  <TableCell>{bom.items?.length || 0}</TableCell>
                  <TableCell>${getTotalCost(bom).toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge className={statusColors[bom.status]}>
                      {statusLabels[bom.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(bom.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedBom(bom)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedBom(bom)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(bom.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredBoms.length === 0 && (
            <div className="text-center py-8">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-semibold">No BOMs found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchTerm || statusFilter !== "all" 
                  ? "No BOMs match your current filters."
                  : "Get started by creating your first BOM."
                }
              </p>
              {!searchTerm && statusFilter === "all" && (
                <div className="mt-6">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create BOM
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}