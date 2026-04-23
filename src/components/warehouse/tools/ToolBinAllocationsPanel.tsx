import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Plus, ArrowLeftRight, Trash2 } from "lucide-react";
import { useToolBinAllocations } from "@/hooks/useToolBinAllocations";
import { useIsAdminOrHigher } from "@/hooks/useIsAdminOrHigher";
import type { WarehouseTool } from "@/types/toolManagement";
import { AllocateToolToBinDialog } from "./AllocateToolToBinDialog";
import { MoveToolBetweenBinsDialog } from "./MoveToolBetweenBinsDialog";

interface Props {
  tool: WarehouseTool;
}

export function ToolBinAllocationsPanel({ tool }: Props) {
  const { allocations, isLoading, remove, isRemoving } = useToolBinAllocations(tool.id);
  const { canDelete } = useIsAdminOrHigher();
  const [allocateOpen, setAllocateOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveFromBin, setMoveFromBin] = useState<string | undefined>(undefined);

  const totalAllocated = allocations.reduce(
    (s, a) => s + Number(a.allocated_quantity ?? 0),
    0
  );

  return (
    <div className="space-y-3 rounded-md border bg-muted/30 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold">Bin Allocations</h4>
          <p className="text-xs text-muted-foreground">
            Total in bins: {totalAllocated} · Tool master total: {tool.total_quantity}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setMoveFromBin(undefined);
              setMoveOpen(true);
            }}
            disabled={allocations.length < 1}
          >
            <ArrowLeftRight className="h-4 w-4 mr-1" />
            Move
          </Button>
          <Button size="sm" onClick={() => setAllocateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Allocate to bin
          </Button>
        </div>
      </div>

      {!tool.location_id && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          Tool has no location assigned. Edit the tool to set one before allocating bins.
        </div>
      )}

      <div className="rounded-md border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bin</TableHead>
              <TableHead className="text-right">Allocated</TableHead>
              <TableHead className="text-right">Reserved</TableHead>
              <TableHead className="text-right">Available</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">
                  Loading…
                </TableCell>
              </TableRow>
            ) : allocations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">
                  No bin allocations yet.
                </TableCell>
              </TableRow>
            ) : (
              allocations.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <div className="font-mono text-xs">{a.bin?.bin_code}</div>
                    <div className="text-sm">{a.bin?.name}</div>
                  </TableCell>
                  <TableCell className="text-right">{Number(a.allocated_quantity)}</TableCell>
                  <TableCell className="text-right">
                    {Number(a.reserved_quantity) > 0 ? (
                      <Badge variant="outline">{Number(a.reserved_quantity)}</Badge>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge
                      variant={Number(a.available_quantity) > 0 ? "default" : "destructive"}
                    >
                      {Number(a.available_quantity)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setMoveFromBin(a.bin_id);
                            setMoveOpen(true);
                          }}
                          disabled={Number(a.available_quantity) <= 0}
                        >
                          <ArrowLeftRight className="h-4 w-4 mr-2" />
                          Move from this bin
                        </DropdownMenuItem>
                        {canDelete && (
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            disabled={
                              isRemoving || Number(a.allocated_quantity) > 0
                            }
                            onClick={() => remove(a.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove allocation
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AllocateToolToBinDialog
        open={allocateOpen}
        onOpenChange={setAllocateOpen}
        tool={tool}
      />
      <MoveToolBetweenBinsDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        tool={tool}
        allocations={allocations}
        fromBinId={moveFromBin}
      />
    </div>
  );
}
