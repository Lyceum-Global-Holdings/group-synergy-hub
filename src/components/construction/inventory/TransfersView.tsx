import { useState } from "react";
import { ArrowRightLeft, Search, ArrowRight, Clock, CheckCircle2, XCircle, Plus } from "lucide-react";
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
import { NewTransferDialog } from "@/components/construction/dialogs/NewTransferDialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { format } from "date-fns";

// Transfer status configuration
const TRANSFER_STATUSES = [
  { value: "pending", label: "Pending", color: "bg-amber-500", icon: Clock },
  { value: "in_transit", label: "In Transit", color: "bg-blue-500", icon: ArrowRightLeft },
  { value: "completed", label: "Completed", color: "bg-green-500", icon: CheckCircle2 },
  { value: "cancelled", label: "Cancelled", color: "bg-red-500", icon: XCircle },
];

interface TransferTransaction {
  id: string;
  item_name: string;
  quantity: number;
  from_location: string;
  to_location: string;
  status: string;
  initiated_date: string;
  completed_date: string | null;
  initiated_by: string;
}

export function TransfersView() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isNewTransferOpen, setIsNewTransferOpen] = useState(false);
  const { selectedCompany } = useCompany();

  // Fetch transfer transactions from the database
  const { data: transfers = [], isLoading } = useQuery({
    queryKey: ["construction-transfers", selectedCompany?.id],
    queryFn: async () => {
      let query = supabase
        .from("construction_inventory_transactions")
        .select(`
          id,
          item_id,
          quantity_change,
          from_location_id,
          to_location_id,
          created_at,
          created_by
        `)
        .eq("transaction_type", "transfer")
        .order("created_at", { ascending: false });

      if (selectedCompany?.id) {
        query = query.eq("company_id", selectedCompany.id);
      }

      const { data: transactions, error } = await query;
      if (error) throw error;

      // Enrich with item names, location names, and user names
      const enrichedTransfers: TransferTransaction[] = await Promise.all(
        (transactions || []).map(async (tx) => {
          // Fetch item name
          const { data: item } = await supabase
            .from("construction_inventory_master")
            .select("item_name")
            .eq("id", tx.item_id)
            .single();

          // Fetch from location
          const { data: fromLoc } = tx.from_location_id
            ? await supabase
                .from("warehouse_locations")
                .select("name")
                .eq("id", tx.from_location_id)
                .single()
            : { data: null };

          // Fetch to location
          const { data: toLoc } = tx.to_location_id
            ? await supabase
                .from("warehouse_locations")
                .select("name")
                .eq("id", tx.to_location_id)
                .single()
            : { data: null };

          // Fetch user name
          const { data: profile } = tx.created_by
            ? await supabase
                .from("profiles")
                .select("full_name, email")
                .eq("id", tx.created_by)
                .single()
            : { data: null };

          return {
            id: tx.id,
            item_name: item?.item_name || "Unknown Item",
            quantity: tx.quantity_change,
            from_location: fromLoc?.name || "—",
            to_location: toLoc?.name || "—",
            status: "completed", // All logged transfers are completed
            initiated_date: tx.created_at,
            completed_date: tx.created_at,
            initiated_by: profile?.full_name || profile?.email || "Unknown",
          };
        })
      );

      return enrichedTransfers;
    },
  });

  const filteredTransfers = transfers.filter((transfer) => {
    const matchesSearch = 
      transfer.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transfer.from_location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transfer.to_location.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || transfer.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const statusConfig = TRANSFER_STATUSES.find((s) => s.value === status);
    const Icon = statusConfig?.icon || Clock;
    return (
      <Badge className={`${statusConfig?.color || "bg-muted"} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {statusConfig?.label || status}
      </Badge>
    );
  };

  // Summary stats
  const pendingCount = transfers.filter(t => t.status === "pending").length;
  const inTransitCount = transfers.filter(t => t.status === "in_transit").length;
  const completedCount = transfers.filter(t => t.status === "completed").length;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Transfers</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount}</div>
            <p className="text-xs text-muted-foreground">Awaiting approval/dispatch</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Transit</CardTitle>
            <ArrowRightLeft className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inTransitCount}</div>
            <p className="text-xs text-muted-foreground">Currently being transferred</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed This Month</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedCount}</div>
            <p className="text-xs text-muted-foreground">Successfully transferred</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and New Transfer Button */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search transfers..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {TRANSFER_STATUSES.map((status) => (
              <SelectItem key={status.value} value={status.value}>
                {status.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => setIsNewTransferOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Transfer
        </Button>
      </div>

      {/* Transfer History Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Transfer History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Loading transfers...</p>
            </div>
          ) : filteredTransfers.length === 0 ? (
            <div className="text-center py-12">
              <ArrowRightLeft className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Transfers Found</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
                Inter-location inventory transfers will appear here. Click "New Transfer" to create one.
              </p>
              <Button onClick={() => setIsNewTransferOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Transfer
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>From → To</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Initiated</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransfers.map((transfer) => (
                  <TableRow key={transfer.id}>
                    <TableCell className="font-medium">{transfer.item_name}</TableCell>
                    <TableCell>{transfer.quantity}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{transfer.from_location}</span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <span>{transfer.to_location}</span>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(transfer.status)}</TableCell>
                    <TableCell>
                      {format(new Date(transfer.initiated_date), "MMM dd, yyyy HH:mm")}
                    </TableCell>
                    <TableCell>
                      {transfer.completed_date
                        ? format(new Date(transfer.completed_date), "MMM dd, yyyy HH:mm")
                        : "-"}
                    </TableCell>
                    <TableCell>{transfer.initiated_by}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* New Transfer Dialog */}
      <NewTransferDialog 
        open={isNewTransferOpen} 
        onOpenChange={setIsNewTransferOpen} 
      />
    </div>
  );
}
