import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, ArrowRightLeft, Plus, Clock, CheckCircle2, Truck, XCircle } from "lucide-react";
import { useTransfers } from "@/hooks/construction/useConstructionInventory";
import { TRANSFER_STATUSES, type TransferStatus } from "@/types/construction-inventory";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { NewTransferDialog } from "./NewTransferDialog";

export function TransfersView() {
  const [isNewTransferOpen, setIsNewTransferOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: transfers, isLoading } = useTransfers(
    statusFilter !== "all" ? statusFilter : undefined
  );

  // Filter transfers
  const filteredTransfers = transfers?.filter(transfer => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      transfer.transfer_number.toLowerCase().includes(term) ||
      (transfer.from_location as any)?.name?.toLowerCase().includes(term) ||
      (transfer.to_location as any)?.name?.toLowerCase().includes(term)
    );
  }) || [];

  const getStatusIcon = (status: TransferStatus) => {
    switch (status) {
      case "pending": return <Clock className="h-4 w-4" />;
      case "in_transit": return <Truck className="h-4 w-4" />;
      case "completed": return <CheckCircle2 className="h-4 w-4" />;
      case "cancelled": return <XCircle className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: TransferStatus) => {
    const styles: Record<TransferStatus, string> = {
      pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
      in_transit: "bg-blue-100 text-blue-800 border-blue-200",
      completed: "bg-green-100 text-green-800 border-green-200",
      cancelled: "bg-gray-100 text-gray-800 border-gray-200",
    };
    return (
      <Badge className={`${styles[status]} flex items-center gap-1`}>
        {getStatusIcon(status)}
        <span className="capitalize">{status.replace(/_/g, " ")}</span>
      </Badge>
    );
  };

  // Summary counts
  const pendingCount = transfers?.filter(t => t.status === "pending").length || 0;
  const inTransitCount = transfers?.filter(t => t.status === "in_transit").length || 0;
  const completedCount = transfers?.filter(t => t.status === "completed").length || 0;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-yellow-800">Pending</p>
                <p className="text-2xl font-bold text-yellow-900">{pendingCount}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-800">In Transit</p>
                <p className="text-2xl font-bold text-blue-900">{inTransitCount}</p>
              </div>
              <Truck className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-800">Completed</p>
                <p className="text-2xl font-bold text-green-900">{completedCount}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by transfer number or location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {TRANSFER_STATUSES.map(status => (
              <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => setIsNewTransferOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Transfer
        </Button>
      </div>

      {/* New Transfer Dialog */}
      <NewTransferDialog 
        open={isNewTransferOpen} 
        onOpenChange={setIsNewTransferOpen} 
      />

      {/* Transfers Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Transfer History</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : filteredTransfers.length === 0 ? (
            <div className="py-12 text-center">
              <ArrowRightLeft className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium">No transfers found</h3>
              <p className="text-sm text-muted-foreground">
                Create a new transfer to move inventory between locations
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Transfer #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransfers.map(transfer => (
                  <TableRow key={transfer.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-mono font-medium">
                      {transfer.transfer_number}
                    </TableCell>
                    <TableCell>
                      {format(new Date(transfer.transfer_date), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      {(transfer.from_location as any)?.name || "-"}
                    </TableCell>
                    <TableCell>
                      {(transfer.to_location as any)?.name || "-"}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(transfer.status as TransferStatus)}
                    </TableCell>
                    <TableCell>
                      {transfer.completed_at 
                        ? format(new Date(transfer.completed_at), "MMM d, yyyy")
                        : "-"
                      }
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
