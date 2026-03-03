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
import { Search, Wrench, Plus, Clock, CheckCircle2, AlertTriangle, Package, Loader2 } from "lucide-react";
import { useRepairRecords } from "@/hooks/construction/useConstructionInventory";
import { useUpdateRepairStatus } from "@/hooks/construction/useUpdateRepairStatus";
import { REPAIR_STATUSES, type RepairStatus, type ConstructionRepairRecord } from "@/types/construction-inventory";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { SendForRepairDialog } from "./SendForRepairDialog";
import { useLocationFilter } from "@/contexts/LocationFilterContext";

// Dropdown options for status changes
const STATUS_CHANGE_OPTIONS: { value: RepairStatus; label: string }[] = [
  { value: "sent_for_repair", label: "Sent for Repair" },
  { value: "in_repair", label: "In Repair" },
  { value: "repaired", label: "Repair Done" },
  { value: "returned", label: "Return to Site" },
];

export function ServiceRepairView() {
  const { globalLocationId } = useLocationFilter();
  const [showSendForRepairDialog, setShowSendForRepairDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [updatingRepairId, setUpdatingRepairId] = useState<string | null>(null);

  const { data: repairs, isLoading } = useRepairRecords(
    statusFilter !== "all" ? statusFilter : undefined
  );

  const updateStatusMutation = useUpdateRepairStatus();

  // Filter repairs by location and search
  const filteredRepairs = repairs?.filter(repair => {
    // Location filter from global context
    if (globalLocationId && (repair.serial_number as any)?.current_location_id !== globalLocationId) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      repair.item_master?.item_name?.toLowerCase().includes(term) ||
      repair.serial_number?.serial_number?.toLowerCase().includes(term) ||
      repair.service_provider?.toLowerCase().includes(term)
    );
  }) || [];

  // Active repairs (not returned or discarded)
  const activeRepairs = filteredRepairs.filter(r => 
    !["returned", "discarded"].includes(r.status)
  );

  // Completed/closed repairs
  const closedRepairs = filteredRepairs.filter(r => 
    ["returned", "discarded"].includes(r.status)
  );

  const handleStatusChange = async (repair: ConstructionRepairRecord, newStatus: RepairStatus) => {
    if (repair.status === newStatus) return;
    
    setUpdatingRepairId(repair.id);
    try {
      await updateStatusMutation.mutateAsync({
        repairId: repair.id,
        newStatus,
        serialNumberId: repair.serial_number_id,
      });
    } finally {
      setUpdatingRepairId(null);
    }
  };

  const getStatusBadge = (status: RepairStatus) => {
    const styles: Record<RepairStatus, string> = {
      sent_for_repair: "bg-yellow-100 text-yellow-800",
      in_repair: "bg-blue-100 text-blue-800",
      repaired: "bg-purple-100 text-purple-800",
      returned: "bg-green-100 text-green-800",
      discarded: "bg-gray-100 text-gray-800",
    };
    return (
      <Badge className={styles[status]}>
        {REPAIR_STATUSES.find(s => s.value === status)?.label || status}
      </Badge>
    );
  };

  // Summary counts
  const sentCount = repairs?.filter(r => r.status === "sent_for_repair").length || 0;
  const inRepairCount = repairs?.filter(r => r.status === "in_repair").length || 0;
  const repairedCount = repairs?.filter(r => r.status === "repaired").length || 0;
  const totalCost = repairs?.reduce((sum, r) => sum + (r.repair_cost || 0), 0) || 0;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Sent for Repair</p>
                <p className="text-2xl font-bold">{sentCount}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">In Repair</p>
                <p className="text-2xl font-bold">{inRepairCount}</p>
              </div>
              <Wrench className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Ready for Return</p>
                <p className="text-2xl font-bold">{repairedCount}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Cost</p>
                <p className="text-2xl font-bold">₹{totalCost.toLocaleString()}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by item, serial number, or provider..."
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
            {REPAIR_STATUSES.map(status => (
              <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => setShowSendForRepairDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Send for Repair
        </Button>
      </div>

      {/* Send for Repair Dialog */}
      <SendForRepairDialog
        open={showSendForRepairDialog}
        onOpenChange={setShowSendForRepairDialog}
      />

      {/* Active Repairs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Items Currently Under Repair ({activeRepairs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : activeRepairs.length === 0 ? (
            <div className="py-8 text-center">
              <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
              <h3 className="font-medium">No items under repair</h3>
              <p className="text-sm text-muted-foreground">
                All inventory items are operational
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Serial #</TableHead>
                  <TableHead>Sent Date</TableHead>
                  <TableHead>Service Provider</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeRepairs.map(repair => (
                  <TableRow key={repair.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {repair.item_master?.image_url ? (
                          <img src={repair.item_master.image_url} alt="" className="h-8 w-8 rounded object-cover" />
                        ) : (
                          <Package className="h-8 w-8 p-1.5 bg-muted rounded" />
                        )}
                        <span>{repair.item_master?.item_name || "Unknown"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono">
                      {repair.serial_number?.serial_number || "-"}
                    </TableCell>
                    <TableCell>
                      {format(new Date(repair.repair_date), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>{repair.service_provider || "-"}</TableCell>
                    <TableCell>
                      {updatingRepairId === repair.id ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm text-muted-foreground">Updating...</span>
                        </div>
                      ) : (
                        <Select
                          value={repair.status}
                          onValueChange={(value) => handleStatusChange(repair, value as RepairStatus)}
                        >
                          <SelectTrigger className="w-[160px] h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_CHANGE_OPTIONS.map(option => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {repair.repair_cost ? `₹${repair.repair_cost.toLocaleString()}` : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Repair History */}
      {closedRepairs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Repair History</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Serial #</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Returned</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {closedRepairs.slice(0, 10).map(repair => (
                  <TableRow key={repair.id}>
                    <TableCell>{repair.item_master?.item_name || "Unknown"}</TableCell>
                    <TableCell className="font-mono">
                      {repair.serial_number?.serial_number || "-"}
                    </TableCell>
                    <TableCell>
                      {format(new Date(repair.repair_date), "MMM d")}
                    </TableCell>
                    <TableCell>
                      {repair.actual_return_date 
                        ? format(new Date(repair.actual_return_date), "MMM d")
                        : "-"
                      }
                    </TableCell>
                    <TableCell>{getStatusBadge(repair.status as RepairStatus)}</TableCell>
                    <TableCell className="text-right">
                      {repair.repair_cost ? `₹${repair.repair_cost.toLocaleString()}` : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
