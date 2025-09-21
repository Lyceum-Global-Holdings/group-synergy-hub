import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Edit, Trash2, Download } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useItemUnits } from '@/hooks/useItemUnits';
import { CreateUnitDialog } from '@/components/warehouse/CreateUnitDialog';
import { ImportStandardUnitsDialog } from '@/components/warehouse/ImportStandardUnitsDialog';
import { ItemUnit } from '@/types/itemBin';

export function ItemUnitsTab() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<ItemUnit | null>(null);
  
  const { units, isLoading, deleteUnit, isDeleting } = useItemUnits();

  const filteredUnits = units.filter(unit =>
    unit.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    unit.abbreviation.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search units..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 w-64"
            />
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={() => setIsImportDialogOpen(true)}>
            <Download className="mr-2 h-4 w-4" />
            Import Standards
          </Button>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Unit
          </Button>
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Abbreviation</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8">
                  Loading units...
                </TableCell>
              </TableRow>
            ) : filteredUnits.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  No units found. Create your first unit to get started.
                </TableCell>
              </TableRow>
            ) : (
              filteredUnits.map((unit) => (
                <TableRow key={unit.id}>
                  <TableCell className="font-medium">{unit.name}</TableCell>
                  <TableCell>{unit.abbreviation}</TableCell>
                  <TableCell>{unit.description || '-'}</TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingUnit(unit)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteUnit(unit.id)}
                        disabled={isDeleting}
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

      <CreateUnitDialog
        open={isCreateDialogOpen || editingUnit !== null}
        onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (!open) setEditingUnit(null);
        }}
        editingUnit={editingUnit}
      />

      <ImportStandardUnitsDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
      />
    </div>
  );
}