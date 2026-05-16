import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Search, Edit, Trash2, Layers, MoveRight } from 'lucide-react';
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
import { useWarehouseLocations } from '@/hooks/useWarehouseLocations';
import { CreateBinDialog } from '@/components/warehouse/CreateBinDialog';
import { BulkBinScopeDialog } from '@/components/warehouse/BulkBinScopeDialog';
import { RelocateBinDialog } from '@/components/warehouse/RelocateBinDialog';
import { WarehouseBin } from '@/types/itemBin';
import { useIsAdminOrHigher } from '@/hooks/useIsAdminOrHigher';

export function BinMasterTab() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingBin, setEditingBin] = useState<WarehouseBin | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkScopeOpen, setIsBulkScopeOpen] = useState(false);
  const [relocatingBin, setRelocatingBin] = useState<WarehouseBin | null>(null);

  const { bins, isLoading, deleteBin, isDeleting } = useWarehouseBins();
  const { locations } = useWarehouseLocations();
  const locationName = (id: string | null | undefined) =>
    (id && locations.find((l) => l.id === id)?.name) || '—';
  const { canDelete } = useIsAdminOrHigher();
  const isAdminOrHigher = canDelete;

  const filteredBins = bins.filter(bin =>
    bin.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    bin.bin_code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const allFilteredSelected = filteredBins.length > 0 && filteredBins.every((b) => selectedIds.includes(b.id));
  const toggleAll = (checked: boolean) => {
    if (checked) setSelectedIds(Array.from(new Set([...selectedIds, ...filteredBins.map((b) => b.id)])));
    else setSelectedIds(selectedIds.filter((id) => !filteredBins.some((b) => b.id === id)));
  };
  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));
  };
  const selectedBins = bins.filter((b) => selectedIds.includes(b.id));

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
        <div className="flex items-center gap-2">
          {isAdminOrHigher && selectedBins.length > 0 && (
            <Button variant="outline" onClick={() => setIsBulkScopeOpen(true)}>
              <Layers className="mr-2 h-4 w-4" />
              Change scope ({selectedBins.length})
            </Button>
          )}
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Bin
          </Button>
        </div>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Bin codes are unique per warehouse and per company. Every sub-location and department under a
          warehouse can use that warehouse's bins automatically — no need to duplicate the bin per floor or
          department.
        </AlertDescription>
      </Alert>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              {isAdminOrHigher && (
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={allFilteredSelected}
                    onCheckedChange={(v) => toggleAll(!!v)}
                    aria-label="Select all bins"
                  />
                </TableHead>
              )}
              <TableHead>Bin Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Warehouse</TableHead>
              <TableHead>Capacity</TableHead>
              <TableHead>Current Qty</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={isAdminOrHigher ? 8 : 7} className="text-center py-8">
                  Loading bins...
                </TableCell>
              </TableRow>
            ) : filteredBins.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdminOrHigher ? 8 : 7} className="text-center py-8 text-muted-foreground">
                  No bins found. Create your first bin to get started.
                </TableCell>
              </TableRow>
            ) : (
              filteredBins.map((bin) => (
                <TableRow key={bin.id} data-state={selectedIds.includes(bin.id) ? 'selected' : undefined}>
                  {isAdminOrHigher && (
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.includes(bin.id)}
                        onCheckedChange={(v) => toggleOne(bin.id, !!v)}
                        aria-label={`Select ${bin.bin_code}`}
                      />
                    </TableCell>
                  )}
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span>{bin.bin_code}</span>
                      {bin.is_global_template && (
                        <Badge variant="outline" className="text-xs">Global</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{bin.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {locationName((bin as any).root_location_id ?? bin.location_id)}
                  </TableCell>
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
                        title="Edit bin"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRelocatingBin(bin)}
                        title="Relocate bin"
                      >
                        <MoveRight className="h-4 w-4" />
                      </Button>
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteBin(bin.id)}
                          disabled={isDeleting}
                          title="Delete bin"
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

      <BulkBinScopeDialog
        open={isBulkScopeOpen}
        onOpenChange={setIsBulkScopeOpen}
        bins={selectedBins}
      />

      <RelocateBinDialog
        open={relocatingBin !== null}
        onOpenChange={(o) => { if (!o) setRelocatingBin(null); }}
        bin={relocatingBin}
      />
    </div>
  );
}