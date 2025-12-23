import { useState } from "react";
import { Plus, Eye, Edit, Trash2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAssetMaster } from "@/hooks/useAssetMaster";
import { useAssetCategories } from "@/hooks/useAssetCategories";
import { useToast } from "@/hooks/use-toast";
import { CreateAssetMasterDialog } from "./CreateAssetMasterDialog";
import { AssetMasterDetailsDialog } from "./AssetMasterDetailsDialog";
import { EditAssetMasterDialog } from "./EditAssetMasterDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AssetMaster } from "@/types/assetMaster";
import { useIsAdminOrHigher } from "@/hooks/useIsAdminOrHigher";

export function AssetMasterTab() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<AssetMaster | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const { assetMasterItems, isLoading, deleteAssetMaster } = useAssetMaster();
  const { categories } = useAssetCategories();
  const { toast } = useToast();
  const { canDelete } = useIsAdminOrHigher();

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return 'N/A';
    const category = categories.find(c => c.id === categoryId);
    return category?.name || 'N/A';
  };

  const filteredAssets = assetMasterItems.filter(asset =>
    asset.asset_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    asset.brand?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleViewDetails = (asset: AssetMaster) => {
    setSelectedAsset(asset);
    setIsDetailsDialogOpen(true);
  };

  const handleEdit = (asset: AssetMaster) => {
    setSelectedAsset(asset);
    setIsEditDialogOpen(true);
  };

  const handleDeleteClick = (asset: AssetMaster) => {
    setSelectedAsset(asset);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (selectedAsset) {
      deleteAssetMaster(selectedAsset.id);
      setIsDeleteDialogOpen(false);
      setSelectedAsset(null);
    }
  };

  const escapeCSV = (value: string | null | undefined): string => {
    if (!value) return '';
    const stringValue = String(value);
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  const handleDownloadCSV = () => {
    const headers = [
      'Asset Name',
      'Brand',
      'Category',
      'Subcategory',
      'Purchase Price (LKR)',
      'Current Value (LKR)',
      'Purchase Date',
      'Depreciation Method',
      'Depreciation Rate (%)',
      'Useful Life (Years)',
      'Salvage Value (LKR)',
      'Accumulated Depreciation (LKR)',
      'Status',
      'Description',
      'Created At',
      'Updated At'
    ];

    const rows = filteredAssets.map(asset => {
      const category = getCategoryName(asset.category_id);
      const subcategory = asset.subcategory_id 
        ? getCategoryName(asset.subcategory_id) 
        : 'N/A';

      return [
        escapeCSV(asset.asset_name),
        escapeCSV(asset.brand || 'N/A'),
        escapeCSV(category),
        escapeCSV(subcategory),
        asset.purchase_price?.toFixed(2) || '0.00',
        asset.current_value?.toFixed(2) || '0.00',
        asset.purchase_date || 'N/A',
        escapeCSV(asset.depreciation_method || 'N/A'),
        asset.depreciation_rate?.toFixed(2) || 'N/A',
        asset.useful_life_years?.toString() || 'N/A',
        asset.salvage_value?.toFixed(2) || '0.00',
        asset.accumulated_depreciation?.toFixed(2) || '0.00',
        asset.status,
        escapeCSV(asset.description || ''),
        new Date(asset.created_at).toLocaleDateString('en-US'),
        new Date(asset.updated_at).toLocaleDateString('en-US')
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    const timestamp = new Date().toISOString().split('T')[0];
    link.download = `asset_master_export_${timestamp}.csv`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export Successful",
      description: `${filteredAssets.length} asset master items exported to CSV.`,
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Master Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{assetMasterItems.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {assetMasterItems.filter(a => a.status === 'active').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{categories.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-between items-center gap-4">
        <Input
          placeholder="Search by name or brand..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleDownloadCSV}
            disabled={filteredAssets.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Download CSV
          </Button>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Image</TableHead>
              <TableHead>Asset Name</TableHead>
              <TableHead>Brand</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Purchase Price</TableHead>
              <TableHead>Current Value</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center">Loading...</TableCell>
              </TableRow>
            ) : filteredAssets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center">No asset master items found</TableCell>
              </TableRow>
            ) : (
              filteredAssets.map((asset) => (
                <TableRow key={asset.id}>
                  <TableCell>
                    {asset.image_url ? (
                      <img
                        src={asset.image_url}
                        alt={asset.asset_name}
                        className="h-12 w-12 object-cover rounded"
                      />
                    ) : (
                      <div className="h-12 w-12 bg-muted rounded flex items-center justify-center text-xs">
                        No Image
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{asset.asset_name}</TableCell>
                  <TableCell>{asset.brand || 'N/A'}</TableCell>
                  <TableCell>{getCategoryName(asset.category_id)}</TableCell>
                  <TableCell>
                    {asset.purchase_price ? `LKR ${asset.purchase_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A'}
                  </TableCell>
                  <TableCell>
                    {asset.current_value ? `LKR ${asset.current_value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A'}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      asset.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {asset.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewDetails(asset)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(asset)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClick(asset)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <CreateAssetMasterDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />

      {selectedAsset && (
        <>
          <AssetMasterDetailsDialog
            asset={selectedAsset}
            open={isDetailsDialogOpen}
            onOpenChange={setIsDetailsDialogOpen}
          />
          <EditAssetMasterDialog
            key={selectedAsset?.id}
            asset={selectedAsset}
            open={isEditDialogOpen}
            onOpenChange={setIsEditDialogOpen}
          />
        </>
      )}

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Asset Master Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedAsset?.asset_name}"? This action cannot be undone.
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
