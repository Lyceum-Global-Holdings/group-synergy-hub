import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Search, Eye, Loader2, FileText, Clock, CheckCircle, XCircle } from "lucide-react";
import { useAssetRequests } from "@/hooks/useAssetRequests";
import { AssetRequestStatus } from "@/types/assetRequest";
import { format } from "date-fns";
import { CreateAssetRequestDialog } from "./CreateAssetRequestDialog";
import { AssetRequestDetailsDialog } from "./AssetRequestDetailsDialog";
import { AssetRequestApprovalDialog } from "./AssetRequestApprovalDialog";

export function AssetRequestsTab() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<AssetRequestStatus | "all">("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isApprovalDialogOpen, setIsApprovalDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);

  const { assetRequests, isLoading } = useAssetRequests(
    statusFilter !== "all" ? { status: statusFilter } : undefined
  );

  const filteredRequests = assetRequests.filter((request) => {
    const matchesSearch =
      request.request_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.requester_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.purpose.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    const variants = {
      draft: "bg-muted text-muted-foreground",
      pending_hod_approval: "bg-warning/10 text-warning border-warning/20",
      pending_procurement_approval: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      approved: "bg-success/10 text-success border-success/20",
      rejected: "bg-destructive/10 text-destructive border-destructive/20",
      fulfilled: "bg-success/20 text-success border-success/30",
      partially_fulfilled: "bg-warning/10 text-warning border-warning/20",
      cancelled: "bg-muted text-muted-foreground",
    };
    return variants[status as keyof typeof variants] || variants.draft;
  };

  const getPriorityBadge = (priority: string) => {
    const variants = {
      low: "bg-muted text-muted-foreground",
      medium: "bg-blue-500/10 text-blue-500",
      high: "bg-warning/10 text-warning",
      urgent: "bg-destructive/10 text-destructive",
    };
    return variants[priority as keyof typeof variants] || variants.medium;
  };

  const pendingApprovalCount = assetRequests.filter((r) =>
    r.status.includes("pending")
  ).length;

  const approvedCount = assetRequests.filter((r) => r.status === "approved").length;

  const totalEstimate = assetRequests.reduce(
    (sum, r) => sum + (r.total_estimated_cost || 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{assetRequests.length}</div>
            <p className="text-xs text-muted-foreground">All asset requests</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">
              {pendingApprovalCount}
            </div>
            <p className="text-xs text-muted-foreground">Awaiting review</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{approvedCount}</div>
            <p className="text-xs text-muted-foreground">Ready for fulfillment</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              LKR {totalEstimate.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Estimated cost</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-1 items-center gap-3">
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search requests..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-[300px]"
            />
          </div>

          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as any)}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="pending_hod_approval">Pending HOD</SelectItem>
              <SelectItem value="pending_procurement_approval">
                Pending Procurement
              </SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="fulfilled">Fulfilled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Request
        </Button>
      </div>

      {/* Requests Table */}
      <Card>
        <CardHeader>
          <CardTitle>Asset Requests</CardTitle>
          <CardDescription>
            Manage and track all asset requisition requests
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Request #</TableHead>
                <TableHead>Requester</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Purpose</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Est. Cost</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Required Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center">
                    <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                    Loading requests...
                  </TableCell>
                </TableRow>
              ) : filteredRequests.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    className="text-center text-muted-foreground"
                  >
                    No requests found
                  </TableCell>
                </TableRow>
              ) : (
                filteredRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-mono text-sm">
                      {request.request_number}
                    </TableCell>
                    <TableCell className="font-medium">
                      {request.requester_name}
                    </TableCell>
                    <TableCell>{request.department || "—"}</TableCell>
                    <TableCell>
                      <div className="max-w-[200px] truncate" title={request.purpose}>
                        {request.purpose}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {/* Will need to fetch items count */}
                      —
                    </TableCell>
                    <TableCell>
                      LKR {request.total_estimated_cost?.toLocaleString() || 0}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={getPriorityBadge(request.priority)}
                        variant="outline"
                      >
                        {request.priority.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={getStatusBadge(request.status)}
                        variant="outline"
                      >
                        {request.status.replace(/_/g, " ").toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(request.required_date), "MMM dd, yyyy")}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedRequest(request);
                          setIsDetailsDialogOpen(true);
                        }}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <CreateAssetRequestDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />

      <AssetRequestDetailsDialog
        request={selectedRequest}
        open={isDetailsDialogOpen}
        onOpenChange={setIsDetailsDialogOpen}
        onApprove={(requestId) => {
          setIsDetailsDialogOpen(false);
          setIsApprovalDialogOpen(true);
        }}
        canApprove={false} // TODO: Implement role-based permissions
      />

      <AssetRequestApprovalDialog
        requestId={selectedRequest?.id}
        approvalLevel="hod" // TODO: Determine based on user role
        open={isApprovalDialogOpen}
        onOpenChange={setIsApprovalDialogOpen}
      />
    </div>
  );
}
