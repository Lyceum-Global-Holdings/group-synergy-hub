import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useFloorMaterialSummary } from "@/hooks/construction/useFloorMaterialSummary";
import { format } from "date-fns";
import { ArrowDownCircle, ArrowUpCircle, Building2, ChevronDown, ChevronRight, Package } from "lucide-react";

interface FloorMaterialSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | null;
  projectName: string;
  reportDate: string | null;
}

export function FloorMaterialSummaryDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  reportDate,
}: FloorMaterialSummaryDialogProps) {
  const { data: summary, isLoading } = useFloorMaterialSummary(projectId, reportDate);
  const [expandedFloors, setExpandedFloors] = useState<Set<string>>(new Set());

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const toggleFloor = (floorId: string) => {
    const newExpanded = new Set(expandedFloors);
    if (newExpanded.has(floorId)) {
      newExpanded.delete(floorId);
    } else {
      newExpanded.add(floorId);
    }
    setExpandedFloors(newExpanded);
  };

  const expandAll = () => {
    setExpandedFloors(new Set(summary?.floors.map(f => f.floorId) || []));
  };

  const collapseAll = () => {
    setExpandedFloors(new Set());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Floor Material Summary - {projectName}
          </DialogTitle>
          {reportDate && (
            <p className="text-sm text-muted-foreground">
              {format(new Date(reportDate), "MMMM d, yyyy")}
            </p>
          )}
        </DialogHeader>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="rounded-lg border bg-green-50 dark:bg-green-950/30 p-4">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <ArrowDownCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Issued Qty</span>
            </div>
            <p className="text-2xl font-bold text-green-700 dark:text-green-400 mt-1">
              {summary?.totalIssued || 0}
            </p>
          </div>
          <div className="rounded-lg border bg-green-50 dark:bg-green-950/30 p-4">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <ArrowDownCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Issued Value</span>
            </div>
            <p className="text-xl font-bold text-green-700 dark:text-green-400 mt-1">
              {formatCurrency(summary?.totalIssuedValue || 0)}
            </p>
          </div>
          <div className="rounded-lg border bg-orange-50 dark:bg-orange-950/30 p-4">
            <div className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
              <ArrowUpCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Returned Qty</span>
            </div>
            <p className="text-2xl font-bold text-orange-700 dark:text-orange-400 mt-1">
              {summary?.totalReturned || 0}
            </p>
          </div>
          <div className="rounded-lg border bg-orange-50 dark:bg-orange-950/30 p-4">
            <div className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
              <ArrowUpCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Returned Value</span>
            </div>
            <p className="text-xl font-bold text-orange-700 dark:text-orange-400 mt-1">
              {formatCurrency(summary?.totalReturnedValue || 0)}
            </p>
          </div>
        </div>

        {/* Floors count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-muted-foreground">
            {summary?.floors.length || 0} floor(s) with activity
          </p>
          {(summary?.floors.length || 0) > 0 && (
            <div className="flex gap-2">
              <button 
                onClick={expandAll}
                className="text-xs text-primary hover:underline"
              >
                Expand All
              </button>
              <span className="text-muted-foreground">|</span>
              <button 
                onClick={collapseAll}
                className="text-xs text-primary hover:underline"
              >
                Collapse All
              </button>
            </div>
          )}
        </div>

        {/* Floor Details with Collapsible Rooms */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : summary?.floors.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No material transactions found for this date.
          </div>
        ) : (
          <div className="space-y-2">
            {summary?.floors.map((floor) => (
              <Collapsible 
                key={floor.floorId} 
                open={expandedFloors.has(floor.floorId)}
                onOpenChange={() => toggleFloor(floor.floorId)}
              >
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/50 hover:bg-muted transition-colors">
                    <div className="flex items-center gap-3">
                      {expandedFloors.has(floor.floorId) ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <Building2 className="h-4 w-4 text-primary" />
                      <span className="font-medium">{floor.floorName}</span>
                      <span className="text-xs text-muted-foreground">
                        ({floor.rooms.length} room{floor.rooms.length !== 1 ? 's' : ''})
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                        <ArrowDownCircle className="h-3 w-3" />
                        <span>{floor.issuedCount}</span>
                        <span className="text-xs text-muted-foreground ml-1">
                          ({formatCurrency(floor.issuedValue)})
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                        <ArrowUpCircle className="h-3 w-3" />
                        <span>{floor.returnedCount}</span>
                        <span className="text-xs text-muted-foreground ml-1">
                          ({formatCurrency(floor.returnedValue)})
                        </span>
                      </div>
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="ml-7 mt-1 border-l-2 border-muted pl-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Room</TableHead>
                          <TableHead className="text-right">Issued Qty</TableHead>
                          <TableHead className="text-right">Issued Value</TableHead>
                          <TableHead className="text-right">Returned Qty</TableHead>
                          <TableHead className="text-right">Returned Value</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {floor.rooms.map((room) => (
                          <TableRow key={room.roomId}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <Package className="h-3 w-3 text-muted-foreground" />
                                {room.roomName}
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-green-600 dark:text-green-400">
                              {room.issuedCount > 0 ? room.issuedCount : '-'}
                            </TableCell>
                            <TableCell className="text-right text-green-600 dark:text-green-400">
                              {room.issuedValue > 0 ? formatCurrency(room.issuedValue) : '-'}
                            </TableCell>
                            <TableCell className="text-right text-orange-600 dark:text-orange-400">
                              {room.returnedCount > 0 ? room.returnedCount : '-'}
                            </TableCell>
                            <TableCell className="text-right text-orange-600 dark:text-orange-400">
                              {room.returnedValue > 0 ? formatCurrency(room.returnedValue) : '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}

            {/* Grand Total */}
            <div className="flex items-center justify-between p-3 rounded-lg border bg-primary/5 mt-4">
              <span className="font-semibold">Grand Total</span>
              <div className="flex items-center gap-6 text-sm font-medium">
                <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                  <ArrowDownCircle className="h-3 w-3" />
                  <span>{summary?.totalIssued || 0}</span>
                  <span className="text-muted-foreground ml-1">
                    ({formatCurrency(summary?.totalIssuedValue || 0)})
                  </span>
                </div>
                <div className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                  <ArrowUpCircle className="h-3 w-3" />
                  <span>{summary?.totalReturned || 0}</span>
                  <span className="text-muted-foreground ml-1">
                    ({formatCurrency(summary?.totalReturnedValue || 0)})
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
