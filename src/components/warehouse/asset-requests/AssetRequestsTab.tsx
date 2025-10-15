import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Eye } from "lucide-react";
import { useAssetRequests } from "@/hooks/useAssetRequests";
import { CreateAssetRequestDialog } from "./CreateAssetRequestDialog";
import { AssetRequestDetailsDialog } from "./AssetRequestDetailsDialog";
import { AssetRequestWithItems, AssetRequestStatus } from "@/types/assetRequest";
import { format } from "date-fns";

export const AssetRequestsTab = () => {
  const { requests, isLoading } = useAssetRequests();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<AssetRequestWithItems | null>(null);

  const getStatusBadge = (status: AssetRequestStatus) => {
    const variants: Record<AssetRequestStatus, { variant: any; label: string }> = {
      draft: { variant: "secondary", label: "Draft" },
      pending_hod_approval: { variant: "outline", label: "Pending HOD" },
      pending_procurement_approval: { variant: "outline", label: "Pending Procurement" },
      approved: { variant: "default", label: "Approved" },
      purchased: { variant: "default", label: "Purchased" },
      pending_delivery: { variant: "outline", label: "Pending Delivery" },
      delivered: { variant: "outline", label: "Delivered" },
      pending_receipt: { variant: "outline", label: "Pending Receipt" },
      received: { variant: "default", label: "Received" },
      fulfilled: { variant: "default", label: "Fulfilled" },
      partially_fulfilled: { variant: "secondary", label: "Partially Fulfilled" },
      rejected: { variant: "destructive", label: "Rejected" },
      cancelled: { variant: "destructive", label: "Cancelled" },
      returned: { variant: "destructive", label: "Returned" },
      partially_returned: { variant: "destructive", label: "Partially Returned" },
    };

    const config = variants[status] || { variant: "secondary", label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, any> = {
      urgent: "destructive",
      high: "default",
      medium: "secondary",
      low: "outline",
    };
    return <Badge variant={variants[priority] || "secondary"}>{priority.toUpperCase()}</Badge>;
  };

  const filteredRequests = requests?.filter((request) => {
    const matchesSearch =
      request.request_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.requester_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.purpose.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "all" || request.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || request.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  if (isLoading) {
    return <div>Loading asset requests...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Asset Requests</h2>
          <p className="text-muted-foreground">Manage asset purchase requests</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Request
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by request number, requester, or purpose..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="pending_hod_approval">Pending HOD</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="purchased">Purchased</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="received">Received</SelectItem>
            <SelectItem value="fulfilled">Fulfilled</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Request #</TableHead>
              <TableHead>Requester</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Purpose</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Required Date</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRequests?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground">
                  No requests found
                </TableCell>
              </TableRow>
            ) : (
              filteredRequests?.map((request) => (
                <TableRow key={request.id}>
                  <TableCell className="font-medium">{request.request_number}</TableCell>
                  <TableCell>{request.requester_name}</TableCell>
                  <TableCell>{request.department || "-"}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{request.purpose}</TableCell>
                  <TableCell>{getPriorityBadge(request.priority)}</TableCell>
                  <TableCell>{getStatusBadge(request.status)}</TableCell>
                  <TableCell>{format(new Date(request.required_date), "MMM dd, yyyy")}</TableCell>
                  <TableCell>{request.asset_request_items?.length || 0}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedRequest(request)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialogs */}
      <CreateAssetRequestDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
      {selectedRequest && (
        <AssetRequestDetailsDialog
          request={selectedRequest}
          open={!!selectedRequest}
          onOpenChange={(open) => !open && setSelectedRequest(null)}
        />
      )}
    </div>
  );
};
