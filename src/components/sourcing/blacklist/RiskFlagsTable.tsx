import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Flag, MoreVertical, Plus, Search } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreateRiskFlagDialog } from "./CreateRiskFlagDialog";
import { RiskFlagDetailsDialog } from "./RiskFlagDetailsDialog";
import { ResolveRiskFlagDialog } from "./ResolveRiskFlagDialog";
import { EscalateRiskFlagDialog } from "./EscalateRiskFlagDialog";
import type { SupplierRiskFlag, RiskSeverity, RiskFlagStatus } from "@/types/supplierRisk";
import { format } from "date-fns";

interface RiskFlagsTableProps {
  data: any[];
  isLoading: boolean;
}

export function RiskFlagsTable({ data, isLoading }: RiskFlagsTableProps) {
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<RiskSeverity | "all">("all");
  const [statusFilter, setStatusFilter] = useState<RiskFlagStatus | "all">("all");
  const [selectedFlag, setSelectedFlag] = useState<any | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showResolveDialog, setShowResolveDialog] = useState(false);
  const [showEscalateDialog, setShowEscalateDialog] = useState(false);

  const filteredData = data.filter(flag => {
    const matchesSearch = flag.suppliers?.name?.toLowerCase().includes(search.toLowerCase()) ||
                         flag.title?.toLowerCase().includes(search.toLowerCase());
    const matchesSeverity = severityFilter === "all" || flag.risk_severity === severityFilter;
    const matchesStatus = statusFilter === "all" || flag.status === statusFilter;
    return matchesSearch && matchesSeverity && matchesStatus;
  });

  const getSeverityBadge = (severity: RiskSeverity) => {
    const config = {
      low: { label: "Low", className: "bg-green-100 text-green-800" },
      medium: { label: "Medium", className: "bg-yellow-100 text-yellow-800" },
      high: { label: "High", className: "bg-orange-100 text-orange-800" },
      critical: { label: "Critical", className: "bg-red-100 text-red-800" },
    };
    const { label, className } = config[severity];
    return <Badge className={className}>{label}</Badge>;
  };

  const getStatusBadge = (status: RiskFlagStatus) => {
    const config = {
      active: { label: "Active", variant: "destructive" as const },
      under_review: { label: "Under Review", variant: "default" as const },
      escalated: { label: "Escalated", variant: "default" as const },
      resolved: { label: "Resolved", variant: "secondary" as const },
    };
    const { label, variant } = config[status];
    return <Badge variant={variant}>{label}</Badge>;
  };

  const handleViewDetails = (flag: any) => {
    setSelectedFlag(flag);
    setShowDetailsDialog(true);
  };

  const handleResolve = (flag: any) => {
    setSelectedFlag(flag);
    setShowResolveDialog(true);
  };

  const handleEscalate = (flag: any) => {
    setSelectedFlag(flag);
    setShowEscalateDialog(true);
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading risk flags...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Filters and Actions */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search risk flags..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={severityFilter} onValueChange={(value: any) => setSeverityFilter(value)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="under_review">Under Review</SelectItem>
            <SelectItem value="escalated">Escalated</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Flag Risk
        </Button>
      </div>

      {/* Table */}
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Supplier</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Flagged Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No risk flags found
                </TableCell>
              </TableRow>
            ) : (
              filteredData.map((flag) => (
                <TableRow key={flag.id}>
                  <TableCell className="font-medium">
                    {flag.suppliers?.name || "Unknown Supplier"}
                  </TableCell>
                  <TableCell className="max-w-xs truncate">{flag.title}</TableCell>
                  <TableCell className="capitalize">{flag.risk_category}</TableCell>
                  <TableCell>{getSeverityBadge(flag.risk_severity)}</TableCell>
                  <TableCell>{getStatusBadge(flag.status)}</TableCell>
                  <TableCell>{format(new Date(flag.flagged_date), "MMM d, yyyy")}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleViewDetails(flag)}>
                          View Details
                        </DropdownMenuItem>
                        {flag.status !== 'resolved' && (
                          <>
                            <DropdownMenuItem onClick={() => handleResolve(flag)}>
                              Mark as Resolved
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEscalate(flag)}>
                              Escalate
                            </DropdownMenuItem>
                          </>
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

      {/* Dialogs */}
      <CreateRiskFlagDialog 
        open={showCreateDialog} 
        onOpenChange={setShowCreateDialog}
      />
      
      {selectedFlag && (
        <>
          <RiskFlagDetailsDialog
            open={showDetailsDialog}
            onOpenChange={setShowDetailsDialog}
            riskFlag={selectedFlag}
          />
          <ResolveRiskFlagDialog
            open={showResolveDialog}
            onOpenChange={setShowResolveDialog}
            riskFlag={selectedFlag}
          />
          <EscalateRiskFlagDialog
            open={showEscalateDialog}
            onOpenChange={setShowEscalateDialog}
            riskFlag={selectedFlag}
          />
        </>
      )}
    </div>
  );
}
