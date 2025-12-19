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
import { useProjectMaterialSummary } from "@/hooks/construction/useRoomMaterialSummary";
import { format } from "date-fns";
import { ArrowDownCircle, ArrowUpCircle, Package } from "lucide-react";

interface RoomMaterialSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | null;
  projectName: string;
  reportDate: string | null;
}

export function RoomMaterialSummaryDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  reportDate,
}: RoomMaterialSummaryDialogProps) {
  const { data: summary, isLoading } = useProjectMaterialSummary(projectId, reportDate);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Material Movement - {projectName}
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
            <p className="text-2xl font-bold text-green-700 dark:text-green-400 mt-1">
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
            <p className="text-2xl font-bold text-orange-700 dark:text-orange-400 mt-1">
              {formatCurrency(summary?.totalReturnedValue || 0)}
            </p>
          </div>
        </div>

        {/* Room Details Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : summary?.roomSummaries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No material transactions found for this date.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Floor</TableHead>
                <TableHead>Room</TableHead>
                <TableHead className="text-right">Issued Qty</TableHead>
                <TableHead className="text-right">Issued Value</TableHead>
                <TableHead className="text-right">Returned Qty</TableHead>
                <TableHead className="text-right">Returned Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary?.roomSummaries.map((room) => (
                <TableRow key={room.roomId}>
                  <TableCell>{room.floorName}</TableCell>
                  <TableCell className="font-medium">{room.roomName}</TableCell>
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
              {/* Totals Row */}
              <TableRow className="bg-muted/50 font-semibold">
                <TableCell colSpan={2}>Total</TableCell>
                <TableCell className="text-right text-green-600 dark:text-green-400">
                  {summary?.totalIssued || 0}
                </TableCell>
                <TableCell className="text-right text-green-600 dark:text-green-400">
                  {formatCurrency(summary?.totalIssuedValue || 0)}
                </TableCell>
                <TableCell className="text-right text-orange-600 dark:text-orange-400">
                  {summary?.totalReturned || 0}
                </TableCell>
                <TableCell className="text-right text-orange-600 dark:text-orange-400">
                  {formatCurrency(summary?.totalReturnedValue || 0)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
