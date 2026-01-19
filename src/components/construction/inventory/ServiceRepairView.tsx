import { useState } from "react";
import { Wrench, Search, Clock, CheckCircle2, AlertTriangle, Package, Plus, XCircle, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { NewRepairDialog } from "@/components/construction/dialogs/NewRepairDialog";
import { useRepairRecords, useUpdateRepairStatus, type RepairStatus } from "@/hooks/construction/useRepairRecords";

// Service/Repair status configuration
const SERVICE_STATUSES: { value: RepairStatus; label: string; color: string }[] = [
  { value: "sent_for_repair", label: "Sent for Repair", color: "bg-amber-500" },
  { value: "in_repair", label: "In Repair", color: "bg-blue-500" },
  { value: "repaired", label: "Repaired", color: "bg-purple-500" },
  { value: "returned", label: "Returned", color: "bg-green-500" },
  { value: "discarded", label: "Discarded", color: "bg-red-500" },
];

export function ServiceRepairView() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isNewRepairOpen, setIsNewRepairOpen] = useState(false);

  const { data: repairRecords = [], isLoading } = useRepairRecords();
  const updateStatus = useUpdateRepairStatus();

  const filteredItems = repairRecords.filter((item) => {
    const matchesSearch =
      item.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.service_provider?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    const matchesStatus = statusFilter === "all" || item.repair_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: RepairStatus) => {
    const statusConfig = SERVICE_STATUSES.find((s) => s.value === status);
    return (
      <Badge className={statusConfig?.color || "bg-muted"}>
        {statusConfig?.label || status.replace(/_/g, " ")}
      </Badge>
    );
  };

  const handleStatusChange = (repairId: string, newStatus: RepairStatus) => {
    updateStatus.mutate({ repairId, newStatus });
  };

  // Summary stats
  const sentCount = repairRecords.filter((i) => i.repair_status === "sent_for_repair").length;
  const inRepairCount = repairRecords.filter((i) => i.repair_status === "in_repair").length;
  const repairedCount = repairRecords.filter((i) => i.repair_status === "repaired").length;
  const returnedCount = repairRecords.filter((i) => i.repair_status === "returned").length;

  // Items currently under repair (not returned or discarded)
  const itemsUnderRepair = repairRecords.filter(
    (i) => !["returned", "discarded"].includes(i.repair_status)
  );

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sent for Repair</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sentCount}</div>
            <p className="text-xs text-muted-foreground">Awaiting service</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Repair</CardTitle>
            <Wrench className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inRepairCount}</div>
            <p className="text-xs text-muted-foreground">Currently being repaired</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Repaired</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{repairedCount}</div>
            <p className="text-xs text-muted-foreground">Ready for pickup</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Returned</CardTitle>
            <RotateCcw className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{returnedCount}</div>
            <p className="text-xs text-muted-foreground">Back in inventory</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Under Repair</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{itemsUnderRepair.length}</div>
            <p className="text-xs text-muted-foreground">Currently out</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search items or service providers..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {SERVICE_STATUSES.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setIsNewRepairOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Repair
        </Button>
      </div>

      {/* Repair History Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Repair History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">
              <Clock className="h-8 w-8 mx-auto text-muted-foreground animate-pulse" />
              <p className="mt-2 text-muted-foreground">Loading repair records...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12">
              <Wrench className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Repair Records Found</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Items sent for service or repair will appear here. Click "New Repair" to send an item for repair.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Item Name</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Repair Status</TableHead>
                  <TableHead>Service Provider</TableHead>
                  <TableHead>Remarks</TableHead>
                  <TableHead>Last Updated By</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-sm">
                      {format(new Date(item.created_at), "dd/MM/yyyy HH:mm")}
                    </TableCell>
                    <TableCell className="font-medium">{item.item_name}</TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell>{item.unit || "-"}</TableCell>
                    <TableCell>
                      {item.warehouse_location?.name || "-"}
                    </TableCell>
                    <TableCell>{getStatusBadge(item.repair_status)}</TableCell>
                    <TableCell>{item.service_provider || "-"}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {item.remarks || "-"}
                    </TableCell>
                    <TableCell>
                      {item.profiles?.full_name || item.profiles?.email || "-"}
                    </TableCell>
                    <TableCell>
                      {!["returned", "discarded"].includes(item.repair_status) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              Update
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {SERVICE_STATUSES.filter(
                              (s) => s.value !== item.repair_status
                            ).map((status) => (
                              <DropdownMenuItem
                                key={status.value}
                                onClick={() => handleStatusChange(item.id, status.value)}
                                disabled={updateStatus.isPending}
                              >
                                {status.value === "returned" && (
                                  <RotateCcw className="h-4 w-4 mr-2 text-green-500" />
                                )}
                                {status.value === "discarded" && (
                                  <XCircle className="h-4 w-4 mr-2 text-red-500" />
                                )}
                                {status.value === "in_repair" && (
                                  <Wrench className="h-4 w-4 mr-2 text-blue-500" />
                                )}
                                {status.value === "repaired" && (
                                  <CheckCircle2 className="h-4 w-4 mr-2 text-purple-500" />
                                )}
                                {status.value === "sent_for_repair" && (
                                  <AlertTriangle className="h-4 w-4 mr-2 text-amber-500" />
                                )}
                                {status.label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Items Under Repair Section */}
      {itemsUnderRepair.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Items Under Repair (Separate from Available Inventory)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item Name</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Original Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent Date</TableHead>
                  <TableHead>Expected Return</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itemsUnderRepair.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.item_name}</TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell>{item.unit || "-"}</TableCell>
                    <TableCell>{item.warehouse_location?.name || "-"}</TableCell>
                    <TableCell>{getStatusBadge(item.repair_status)}</TableCell>
                    <TableCell>
                      {format(new Date(item.sent_date), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell>
                      {item.expected_return_date
                        ? format(new Date(item.expected_return_date), "dd/MM/yyyy")
                        : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* New Repair Dialog */}
      <NewRepairDialog open={isNewRepairOpen} onOpenChange={setIsNewRepairOpen} />
    </div>
  );
}
