import { useState } from "react";
import { Plus, FileText, Edit, Trash2, Eye, Sparkles, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBillOfMaterials } from "@/hooks/useBillOfMaterials";
import { useCompany } from "@/contexts/CompanyContext";
import { BillOfMaterials } from "@/types/bom";
import { useQueryClient } from "@tanstack/react-query";
import { CreateBomDialog } from "@/components/procurement/CreateBomDialog";
import { BomDetailsDialog } from "@/components/procurement/BomDetailsDialog";
import { EditBomDialog } from "@/components/procurement/EditBomDialog";
import { BulkLinkProductsDialog } from "@/components/procurement/BulkLinkProductsDialog";
import { useBomLinkedProductsCounts, useBomLinkedProductsDetails } from "@/hooks/useBomFinishedGoodsLinks";

const statusColors = {
  active: "bg-success text-success-foreground",
  inactive: "bg-destructive text-destructive-foreground", 
  draft: "bg-warning text-warning-foreground",
};

const statusLabels = {
  active: "Active",
  inactive: "Inactive",
  draft: "Draft",
};

export default function BillOfMaterialsPage() {
  const { selectedCompany, isViewingAllCompanies } = useCompany();
  const { boms, isLoading, deleteBom, isDeleting, duplicateBom, isDuplicating } = useBillOfMaterials(isViewingAllCompanies ? undefined : selectedCompany?.id);
  const { data: linkedProductCounts = {} } = useBomLinkedProductsCounts();
  const { data: linkedProductsDetails = {} } = useBomLinkedProductsDetails();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedBom, setSelectedBom] = useState<BillOfMaterials | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [bulkLinkBomId, setBulkLinkBomId] = useState<string>("");
  const [bulkLinkProductMasterId, setBulkLinkProductMasterId] = useState<string>("");
  const [bulkLinkDialogOpen, setBulkLinkDialogOpen] = useState(false);

  // Filter BOMs
  const filteredBoms = boms.filter((bom) => {
    const matchesSearch = bom.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         bom.bom_number.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || bom.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this BOM?")) {
      await deleteBom(id);
    }
  };

  const handleDuplicate = async (id: string) => {
    if (confirm("Duplicate this BOM? This will create a copy with all items and linked products.")) {
      try {
        await duplicateBom(id);
        // Get the newly created BOM from the cache
        const updatedBoms = queryClient.getQueryData(['bill-of-materials', isViewingAllCompanies ? undefined : selectedCompany?.id]) as BillOfMaterials[] | undefined;
        if (updatedBoms && updatedBoms.length > 0) {
          // The newest BOM will be the one we just created
          const newestBom = updatedBoms.reduce((prev, current) => 
            new Date(current.created_at) > new Date(prev.created_at) ? current : prev
          );
          setSelectedBom(newestBom);
          setIsEditDialogOpen(true);
        }
      } catch (error) {
        console.error('Error duplicating BOM:', error);
      }
    }
  };

  const getStatusBadge = (status: string) => (
    <Badge className={statusColors[status as keyof typeof statusColors]}>
      {statusLabels[status as keyof typeof statusLabels]}
    </Badge>
  );

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Bill of Materials</h1>
          <p className="text-muted-foreground">
            Manage BOMs for {isViewingAllCompanies ? 'All Companies' : (selectedCompany?.name || 'your company')}
          </p>
        </div>
        <CreateBomDialog>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create BOM
          </Button>
        </CreateBomDialog>
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
              {boms.filter(b => b.status === 'active').length}
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
              {boms.filter(b => b.status === 'draft').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Company</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">
              {isViewingAllCompanies ? 'All' : selectedCompany?.code}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search BOMs by product name or BOM number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            {(searchTerm || statusFilter !== "all") && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("all");
                }}
              >
                Clear Filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* BOMs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Bill of Materials</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>BOM Number</TableHead>
                <TableHead>Product Name</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Linked Products</TableHead>
                <TableHead>Colors & Sizes</TableHead>
                {isViewingAllCompanies && <TableHead>Company</TableHead>}
                <TableHead>Created Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBoms.map((bom) => (
                <TableRow key={bom.id}>
                  <TableCell className="font-medium">{bom.bom_number}</TableCell>
                  <TableCell>{bom.product_name}</TableCell>
                  <TableCell>{bom.version}</TableCell>
                  <TableCell>{getStatusBadge(bom.status)}</TableCell>
                  <TableCell>
                    {linkedProductCounts[bom.id] > 0 ? (
                      <Badge variant="secondary">
                        {linkedProductCounts[bom.id]} linked
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">None</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {linkedProductsDetails[bom.id] && linkedProductsDetails[bom.id].length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {linkedProductsDetails[bom.id].slice(0, 3).map((product, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {product.color && product.size 
                              ? `${product.color} / ${product.size}`
                              : product.color || product.size || 'N/A'
                            }
                          </Badge>
                        ))}
                        {linkedProductsDetails[bom.id].length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{linkedProductsDetails[bom.id].length - 3}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  {isViewingAllCompanies && (
                    <TableCell>
                      <Badge variant="outline">
                        {bom.company_id ? 'Company' : 'N/A'}
                      </Badge>
                    </TableCell>
                  )}
                  <TableCell>
                    {new Date(bom.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedBom(bom);
                          setIsEditMode(false);
                          setIsDetailsDialogOpen(true);
                        }}
                        title="View details"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setBulkLinkBomId(bom.id);
                          setBulkLinkProductMasterId(bom.product_master_id || '');
                          setBulkLinkDialogOpen(true);
                        }}
                        disabled={!bom.product_master_id}
                        title={bom.product_master_id ? "Link products from product master" : "No product master linked"}
                      >
                        <Sparkles className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedBom(bom);
                          setIsEditMode(true);
                          setIsDetailsDialogOpen(true);
                        }}
                        title="Edit BOM"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDuplicate(bom.id)}
                        disabled={isDuplicating}
                        title="Duplicate BOM"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(bom.id)}
                        disabled={isDeleting}
                        title="Delete BOM"
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
            <div className="text-center py-8 text-muted-foreground">
              No BOMs found. Create your first BOM to get started.
            </div>
          )}
        </CardContent>
      </Card>

      {/* BOM Details Dialog */}
      <BomDetailsDialog
        bom={selectedBom}
        open={isDetailsDialogOpen && !isEditMode}
        onOpenChange={(open) => {
          setIsDetailsDialogOpen(open);
          if (!open) {
            setSelectedBom(null);
            setIsEditMode(false);
          }
        }}
        onEdit={(bom) => {
          setSelectedBom(bom);
          setIsEditMode(true);
        }}
      />

      {/* Edit BOM Dialog */}
      <EditBomDialog
        bom={selectedBom}
        open={isDetailsDialogOpen && isEditMode}
        onOpenChange={(open) => {
          setIsDetailsDialogOpen(open);
          if (!open) {
            setSelectedBom(null);
            setIsEditMode(false);
          }
        }}
      />

      {/* Edit BOM Dialog (from duplicate) */}
      <EditBomDialog
        bom={selectedBom}
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) {
            setSelectedBom(null);
          }
        }}
      />

      {/* Bulk Link Products Dialog */}
      <BulkLinkProductsDialog
        open={bulkLinkDialogOpen}
        onOpenChange={setBulkLinkDialogOpen}
        bomId={bulkLinkBomId}
        productMasterId={bulkLinkProductMasterId}
        companyId={selectedCompany?.id}
      />
    </div>
  );
}