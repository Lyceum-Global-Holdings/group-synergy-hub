import { useEffect, useMemo, useState } from 'react';
import { useInfiniteQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Search, Loader2, Plus, PackageSearch } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BrowsePickedRow {
  id: string;
  item_code: string;
  name: string;
  description: string | null;
  unit_of_measure: string | null;
  current_stock: number;
  bin_code: string | null;
  quantity: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string | null;
  locationId: string | null;
  existingItemIds: string[];
  onConfirm: (rows: BrowsePickedRow[]) => void;
}

const PAGE_SIZE = 50;

export function BrowseInventoryDialog({
  open,
  onOpenChange,
  companyId,
  locationId,
  existingItemIds,
  onConfirm,
}: Props) {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [selected, setSelected] = useState<Map<string, BrowsePickedRow>>(new Map());

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      setSelected(new Map());
      setSearch('');
      setDebounced('');
    }
  }, [open]);

  const {
    data,
    isFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['browse-inventory', companyId, locationId, debounced],
    enabled: open && !!locationId,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    initialPageParam: null as { created_at: string; id: string } | null,
    getNextPageParam: (last: any[]) => {
      if (!last || last.length < PAGE_SIZE) return undefined;
      const tail = last[last.length - 1];
      return { created_at: tail.created_at, id: tail.id };
    },
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc('list_warehouse_inventory' as any, {
        _company_id: companyId,
        _search: debounced || null,
        _category_id: null,
        _status: 'active',
        _location_ids: locationId ? [locationId] : null,
        _cursor_created_at: pageParam?.created_at ?? null,
        _cursor_id: pageParam?.id ?? null,
        _limit: PAGE_SIZE,
        _stock_mode: 'in_stock',
      } as any);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const rows = useMemo(() => (data?.pages ?? []).flat(), [data]);

  const toggleRow = (row: any, checked: boolean) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (!checked) {
        next.delete(row.id);
        return next;
      }
      const avail = Number(row.current_stock || 0);
      const firstBin = Array.isArray(row.bins) && row.bins.length > 0 ? row.bins[0] : null;
      next.set(row.id, {
        id: row.id,
        item_code: row.item_code,
        name: row.name,
        description: row.description,
        unit_of_measure: row.unit_abbreviation || row.unit_name || null,
        current_stock: avail,
        bin_code: firstBin?.bin_code || null,
        quantity: avail > 0 ? 1 : 0,
      });
      return next;
    });
  };

  const setQty = (id: string, qty: number) => {
    setSelected((prev) => {
      const next = new Map(prev);
      const cur = next.get(id);
      if (!cur) return prev;
      next.set(id, { ...cur, quantity: isNaN(qty) ? 0 : qty });
      return next;
    });
  };

  const allOnPageSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAllOnPage = (checked: boolean) => {
    if (checked) {
      rows.forEach((r) => {
        if (!selected.has(r.id)) toggleRow(r, true);
      });
    } else {
      setSelected((prev) => {
        const next = new Map(prev);
        rows.forEach((r) => next.delete(r.id));
        return next;
      });
    }
  };

  const selectedList = Array.from(selected.values());
  const invalid = selectedList.filter(
    (r) => r.quantity <= 0 || r.quantity > r.current_stock,
  );
  const totalUnits = selectedList.reduce((sum, r) => sum + (r.quantity || 0), 0);

  const handleConfirm = () => {
    if (invalid.length > 0 || selectedList.length === 0) return;
    onConfirm(selectedList);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageSearch className="h-5 w-5" />
            Browse Available Inventory
          </DialogTitle>
          <DialogDescription>
            Showing in-stock items at the selected issue location. Tick items, adjust
            quantity, then add them to the MIN in one click.
          </DialogDescription>
        </DialogHeader>

        {!locationId ? (
          <div className="p-6 text-center text-muted-foreground border rounded-md">
            Select an Issue Location on the Header step first.
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by code, name, brand…"
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
              {isFetching && (
                <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>

            <div className="border rounded-md max-h-[420px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allOnPageSelected}
                        onCheckedChange={(v) => toggleAllOnPage(!!v)}
                        aria-label="Select all on page"
                      />
                    </TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>UoM</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                    <TableHead>Bin</TableHead>
                    <TableHead className="w-32">Qty to Issue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 && !isFetching && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No in-stock items match this search.
                      </TableCell>
                    </TableRow>
                  )}
                  {rows.map((row: any) => {
                    const sel = selected.get(row.id);
                    const checked = !!sel;
                    const already = existingItemIds.includes(row.id);
                    const avail = Number(row.current_stock || 0);
                    const firstBin =
                      Array.isArray(row.bins) && row.bins.length > 0 ? row.bins[0] : null;
                    const qtyInvalid =
                      sel && (sel.quantity <= 0 || sel.quantity > avail);
                    return (
                      <TableRow
                        key={row.id}
                        className={cn(checked && 'bg-muted/40', qtyInvalid && 'bg-destructive/10')}
                      >
                        <TableCell>
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => toggleRow(row, !!v)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {row.item_code}
                            </Badge>
                            {already && (
                              <Badge variant="secondary" className="text-[10px]">
                                already in MIN
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{row.name}</TableCell>
                        <TableCell>{row.unit_abbreviation || row.unit_name || '—'}</TableCell>
                        <TableCell className="text-right tabular-nums">{avail}</TableCell>
                        <TableCell>{firstBin?.bin_code || '—'}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            max={avail}
                            step="0.01"
                            value={sel ? sel.quantity : ''}
                            disabled={!checked}
                            onChange={(e) => setQty(row.id, parseFloat(e.target.value))}
                            className={cn('h-8', qtyInvalid && 'border-destructive')}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between text-sm">
              <div className="text-muted-foreground">
                Showing {rows.length} item{rows.length === 1 ? '' : 's'}
                {selected.size > 0 && (
                  <>
                    {' · '}
                    <span className="font-medium text-foreground">
                      {selected.size} selected · {totalUnits} units
                    </span>
                  </>
                )}
                {invalid.length > 0 && (
                  <span className="ml-2 text-destructive">
                    ({invalid.length} qty issue{invalid.length === 1 ? '' : 's'})
                  </span>
                )}
              </div>
              {hasNextPage && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                >
                  {isFetchingNextPage ? 'Loading…' : 'Load more'}
                </Button>
              )}
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={selected.size === 0 || invalid.length > 0}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add {selected.size > 0 ? selected.size : ''} to MIN
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
