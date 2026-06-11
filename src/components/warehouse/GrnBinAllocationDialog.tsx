import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useWarehouseBins } from '@/hooks/useWarehouseBins';
import { useWarehouseCatalogPage } from '@/hooks/useWarehouseCatalogPage';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Package, ChevronsUpDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocationFilter } from '@/contexts/LocationFilterContext';
import { useWarehouseLocations } from '@/hooks/useWarehouseLocations';
import { getRootLocationId } from '@/lib/warehouse/locationHierarchy';

interface GrnItem {
  id: string;
  item_name: string;
  item_code?: string;
  quantity_received: number;
  warehouse_item_id?: string | null;
  unit_of_measure?: string;
}

export interface BinAllocation {
  grn_item_id: string;
  warehouse_item_id: string;
  bin_id: string;
  location_id: string | null;
  quantity: number;
}

interface GrnBinAllocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: GrnItem[];
  companyId?: string | null;
  onConfirm: (
    allocations: BinAllocation[],
    itemLinks: Record<string, string>,
  ) => void;
  isLoading?: boolean;
}

interface RowState {
  warehouseItemId: string;
  binId: string;
  itemLabel: string;
  itemCode: string;
}

export function GrnBinAllocationDialog({
  open,
  onOpenChange,
  items,
  companyId,
  onConfirm,
  isLoading,
}: GrnBinAllocationDialogProps) {
  const { bins } = useWarehouseBins();
  const { globalLocationId } = useLocationFilter();
  const { locations } = useWarehouseLocations();
  const selectedRootLocationId = getRootLocationId(locations, globalLocationId);
  const activeBins = bins.filter((b) => {
    if (b.status !== 'active') return false;
    if (!selectedRootLocationId) return true;
    return (b.root_location_id ?? b.location_id) === selectedRootLocationId;
  });

  const allocatableItems = useMemo(
    () => items.filter((i) => i.quantity_received > 0),
    [items],
  );

  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [openPicker, setOpenPicker] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [linking, setLinking] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const { data: catalogPages, fetchNextPage, hasNextPage, isFetching, isFetchingNextPage } =
    useWarehouseCatalogPage({
      search: debouncedSearch || undefined,
      status: 'active',
      pageSize: 50,
      enabled: open && openPicker !== null,
    });
  const catalogItems = (catalogPages?.pages ?? []).flat();

  useEffect(() => {
    if (open) {
      const initial: Record<string, RowState> = {};
      for (const it of allocatableItems) {
        initial[it.id] = {
          warehouseItemId: it.warehouse_item_id || '',
          binId: '',
          itemLabel: it.item_name,
          itemCode: it.item_code || '',
        };
      }
      setRows(initial);
      setSearch('');
      setOpenPicker(null);
    }
  }, [open, allocatableItems]);

  const allComplete =
    allocatableItems.length > 0 &&
    allocatableItems.every((i) => {
      const r = rows[i.id];
      return r?.warehouseItemId && r?.binId;
    });

  const handlePickCatalogItem = async (rowId: string, catalogItem: any) => {
    if (!companyId) {
      toast.error('Missing company on this GRN');
      return;
    }
    setLinking(rowId);
    try {
      const { data: warehouseItemId, error } = await supabase.rpc(
        'ensure_warehouse_item_for_company' as any,
        { p_company_id: companyId, p_catalog_item_id: catalogItem.id },
      );
      if (error) throw error;
      setRows((prev) => ({
        ...prev,
        [rowId]: {
          ...prev[rowId],
          warehouseItemId: warehouseItemId as unknown as string,
          itemLabel: catalogItem.name,
          itemCode: catalogItem.item_code,
        },
      }));
      setOpenPicker(null);
      setSearch('');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to link item');
    } finally {
      setLinking(null);
    }
  };

  const handleConfirm = () => {
    const allocations: BinAllocation[] = [];
    const itemLinks: Record<string, string> = {};
    for (const it of allocatableItems) {
      const r = rows[it.id];
      if (!r?.warehouseItemId || !r.binId) continue;
      allocations.push({
        grn_item_id: it.id,
        warehouse_item_id: r.warehouseItemId,
        bin_id: r.binId,
        location_id:
          globalLocationId ??
          activeBins.find((b) => b.id === r.binId)?.location_id ??
          null,
        quantity: it.quantity_received,
      });
      if (!it.warehouse_item_id || it.warehouse_item_id !== r.warehouseItemId) {
        itemLinks[it.id] = r.warehouseItemId;
      }
    }
    onConfirm(allocations, itemLinks);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Allocate Stock to Bins
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Link each line to an item master entry (if not already linked) and choose a destination bin.
        </p>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Warehouse Item</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead>UOM</TableHead>
              <TableHead>Destination Bin</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allocatableItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No items received on this GRN
                </TableCell>
              </TableRow>
            ) : (
              allocatableItems.map((item) => {
                const row = rows[item.id];
                const linked = !!row?.warehouseItemId;
                const wasPreLinked = !!item.warehouse_item_id;
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="font-medium">{item.item_name}</div>
                      {item.item_code && (
                        <div className="text-xs text-muted-foreground">{item.item_code}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      {wasPreLinked ? (
                        <span className="text-xs text-muted-foreground">
                          {row?.itemCode || '—'}
                        </span>
                      ) : (
                        <Popover
                          open={openPicker === item.id}
                          onOpenChange={(o) => {
                            setOpenPicker(o ? item.id : null);
                            if (o) setSearch('');
                          }}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              size="sm"
                              className="w-[240px] justify-between"
                              disabled={linking === item.id}
                            >
                              <span className="truncate">
                                {linked
                                  ? `${row?.itemLabel}${row?.itemCode ? ` (${row.itemCode})` : ''}`
                                  : 'Select item…'}
                              </span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50 shrink-0" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[320px] p-0" align="start">
                            <Command shouldFilter={false}>
                              <CommandInput
                                placeholder="Search item master…"
                                value={search}
                                onValueChange={setSearch}
                              />
                              <CommandList
                                onScroll={(e) => {
                                  const el = e.currentTarget;
                                  if (
                                    hasNextPage &&
                                    !isFetchingNextPage &&
                                    el.scrollHeight - el.scrollTop - el.clientHeight < 80
                                  ) {
                                    fetchNextPage();
                                  }
                                }}
                              >
                                <CommandEmpty>
                                  <div className="py-2 px-3 text-sm text-muted-foreground">
                                    {isFetching ? 'Searching…' : 'No items found'}
                                  </div>
                                </CommandEmpty>
                                <CommandGroup heading="Item Master">
                                  {catalogItems.map((wi: any) => (
                                    <CommandItem
                                      key={wi.id}
                                      value={wi.id}
                                      onSelect={() => handlePickCatalogItem(item.id, wi)}
                                    >
                                      <Check
                                        className={cn(
                                          'mr-2 h-4 w-4',
                                          row?.warehouseItemId === wi.id ? 'opacity-100' : 'opacity-0',
                                        )}
                                      />
                                      <div className="flex flex-col">
                                        <span>{wi.name}</span>
                                        <span className="text-xs text-muted-foreground">
                                          {wi.item_code}
                                        </span>
                                      </div>
                                    </CommandItem>
                                  ))}
                                  {(isFetching || isFetchingNextPage) && (
                                    <div className="py-2 px-3 text-xs text-muted-foreground">
                                      Loading…
                                    </div>
                                  )}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{item.quantity_received}</TableCell>
                    <TableCell>{item.unit_of_measure || '-'}</TableCell>
                    <TableCell>
                      <Select
                        value={row?.binId || ''}
                        onValueChange={(value) =>
                          setRows((prev) => ({
                            ...prev,
                            [item.id]: { ...prev[item.id], binId: value },
                          }))
                        }
                        disabled={!linked}
                      >
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder={linked ? 'Select bin…' : 'Link item first'} />
                        </SelectTrigger>
                        <SelectContent>
                          {activeBins.map((bin) => (
                            <SelectItem key={bin.id} value={bin.id}>
                              {bin.bin_code} — {bin.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!allComplete || isLoading}>
            {isLoading ? 'Approving…' : 'Confirm & Approve'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
