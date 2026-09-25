import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Edit, Trash2, Download, Ruler, Globe } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useItemUnits } from '@/hooks/useItemUnits';
import { CreateUnitDialog } from '@/components/warehouse/CreateUnitDialog';
import { ImportStandardUnitsDialog } from '@/components/warehouse/ImportStandardUnitsDialog';
import { ItemUnit } from '@/types/itemBin';
import { useIsAdminOrHigher } from '@/hooks/useIsAdminOrHigher';
import { EmptyState, SearchField, Toolbar, iconBtn, pillButton } from '@/components/warehouse/master/masterUi';
import { cn } from '@/lib/utils';

export function ItemUnitsTab() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<ItemUnit | null>(null);
  const [deletingUnit, setDeletingUnit] = useState<ItemUnit | null>(null);

  const { units, isLoading, deleteUnit, isDeleting } = useItemUnits();
  const { canDelete } = useIsAdminOrHigher();

  const q = searchTerm.toLowerCase();
  const filteredUnits = units
    .filter((unit) => unit.name.toLowerCase().includes(q) || unit.abbreviation.toLowerCase().includes(q) || (unit.description ?? '').toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-4">
      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <SearchField value={searchTerm} onChange={setSearchTerm} placeholder="Search unit name or abbreviation…" />
          <span className="text-xs text-muted-foreground">
            {isLoading ? 'Loading…' : `${filteredUnits.length} of ${units.length} units`}
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className={pillButton} onClick={() => setIsImportDialogOpen(true)}>
              <Download className="mr-2 h-4 w-4" />
              Import standards
            </Button>
            <Button size="sm" className="h-9 rounded-full px-4" onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add unit
            </Button>
          </div>
        </div>
      </Toolbar>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4">
              <div className="h-11 w-11 animate-pulse rounded-xl bg-muted" />
              <div className="space-y-1.5">
                <div className="h-3.5 w-24 animate-pulse rounded bg-muted" />
                <div className="h-3 w-36 animate-pulse rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredUnits.length === 0 ? (
        <div className="rounded-2xl border border-border/60 bg-card">
          <EmptyState
            icon={Ruler}
            title={searchTerm ? 'No units match' : 'No units yet'}
            description={searchTerm ? 'Try another name or abbreviation.' : 'Add a unit, or import the standard set (pcs, kg, m, l…).'}
            action={
              searchTerm ? (
                <Button variant="outline" size="sm" className="rounded-full" onClick={() => setSearchTerm('')}>
                  Clear search
                </Button>
              ) : (
                <Button variant="outline" size="sm" className="rounded-full" onClick={() => setIsImportDialogOpen(true)}>
                  <Download className="mr-1.5 h-4 w-4" /> Import standard units
                </Button>
              )
            }
          />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredUnits.map((unit) => (
            <div
              key={unit.id}
              className="group flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-[var(--shadow-xs)] transition-shadow hover:shadow-[var(--shadow-sm)]"
            >
              <div className="flex items-start justify-between gap-2">
                <span
                  className="flex h-11 min-w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 px-2 font-mono text-sm font-semibold text-primary"
                  title={`Abbreviation: ${unit.abbreviation}`}
                >
                  {unit.abbreviation}
                </span>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button type="button" className={iconBtn} onClick={() => setEditingUnit(unit)} title="Edit unit" aria-label={`Edit ${unit.name}`}>
                    <Edit className="h-4 w-4" />
                  </button>
                  {canDelete && (
                    <button
                      type="button"
                      className={cn(iconBtn, 'hover:bg-destructive/10 hover:text-destructive')}
                      onClick={() => setDeletingUnit(unit)}
                      disabled={isDeleting}
                      title="Delete unit"
                      aria-label={`Delete ${unit.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium">{unit.name}</span>
                  {!unit.company_id && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700" title="Shared across companies">
                      <Globe className="h-3 w-3" /> Global
                    </span>
                  )}
                </div>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{unit.description || 'No description'}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={deletingUnit !== null} onOpenChange={(o) => { if (!o) setDeletingUnit(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete unit “{deletingUnit?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This can&apos;t be undone. A unit that items still use can&apos;t be deleted — the system will refuse it,
              so change those items to another unit first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deletingUnit) deleteUnit(deletingUnit.id); setDeletingUnit(null); }}
            >
              Delete unit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
