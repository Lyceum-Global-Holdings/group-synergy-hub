import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Edit, Trash2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { useWarehouseBins } from '@/hooks/useWarehouseBins';
import { CreateBinDialog } from '@/components/warehouse/CreateBinDialog';
import { WarehouseBin } from '@/types/itemBin';
import { useRealtimeStockUpdates } from '@/hooks/useRealtimeStockUpdates';
import { useIsAdminOrHigher } from '@/hooks/useIsAdminOrHigher';

export function BinMasterTab() {
  // Enable real-time stock updates
  useRealtimeStockUpdates();
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingBin, setEditingBin] = useState<WarehouseBin | null>(null);
  
  const { bins, isLoading, deleteBin, isDeleting } = useWarehouseBins();
  const { canDelete } = useIsAdminOrHigher();

  const filteredBins = bins.filter(bin =>
    bin.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    bin.bin_code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 border-green-200';
      case 'inactive': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'maintenance': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'full': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search bins..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 w-64"
            />
          </div>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Bin
        </Button>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Bins are shared across all companies and scoped by warehouse location.
        </AlertDescription>
      </Alert>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bin Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Capacity</TableHead>
              <TableHead>Current Qty</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  Loading bins...
                </TableCell>
              </TableRow>
            ) : filteredBins.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No bins found. Create your first bin to get started.
                </TableCell>
              </TableRow>
            ) : (
              filteredBins.map((bin) => (
                <TableRow key={bin.id}>
                  <TableCell className="font-medium">{bin.bin_code}</TableCell>
                  <TableCell>{bin.name}</TableCell>
                  <TableCell>{bin.capacity || '-'}</TableCell>
                  <TableCell>{bin.current_quantity || 0}</TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(bin.status)}>
                      {bin.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingBin(bin)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteBin(bin.id)}
                          disabled={isDeleting}
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

      <CreateBinDialog
        open={isCreateDialogOpen || editingBin !== null}
        onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (!open) setEditingBin(null);
        }}
        editingBin={editingBin}
      />
    </div>
  );
}