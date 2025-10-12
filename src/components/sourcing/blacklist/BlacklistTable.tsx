import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Ban, Eye, CheckCircle, MoreVertical, Plus, Search } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BlacklistSupplierDialog } from "./BlacklistSupplierDialog";
import { ClearBlacklistDialog } from "./ClearBlacklistDialog";
import { BlacklistDetailsDialog } from "./BlacklistDetailsDialog";
import type { SupplierBlacklist, BlacklistStatus } from "@/types/supplierRisk";
import { format } from "date-fns";

interface BlacklistTableProps {
  data: any[];
  isLoading: boolean;
}

export function BlacklistTable({ data, isLoading }: BlacklistTableProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<BlacklistStatus | "all">("all");
  const [selectedEntry, setSelectedEntry] = useState<any | null>(null);
  const [showBlacklistDialog, setShowBlacklistDialog] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  const filteredData = data.filter(entry => {
    const matchesSearch = entry.suppliers?.name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || entry.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: BlacklistStatus) => {
    const config = {
      blacklisted: { label: "Blacklisted", variant: "destructive" as const, icon: Ban },
      watchlist: { label: "Watchlist", variant: "default" as const, icon: Eye },
      cleared: { label: "Cleared", variant: "secondary" as const, icon: CheckCircle },
    };
    const { label, variant, icon: Icon } = config[status];
    return (
      <Badge variant={variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {label}
      </Badge>
    );
  };

  const handleViewDetails = (entry: any) => {
    setSelectedEntry(entry);
    setShowDetailsDialog(true);
  };

  const handleClearSupplier = (entry: any) => {
    setSelectedEntry(entry);
    setShowClearDialog(true);
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading blacklist entries...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Filters and Actions */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search suppliers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="blacklisted">Blacklisted</SelectItem>
            <SelectItem value="watchlist">Watchlist</SelectItem>
            <SelectItem value="cleared">Cleared</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setShowBlacklistDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add to Blacklist
        </Button>
      </div>

      {/* Table */}
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Supplier</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Blacklisted Date</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Next Review</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No blacklist entries found
                </TableCell>
              </TableRow>
            ) : (
              filteredData.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium">
                    {entry.suppliers?.name || "Unknown Supplier"}
                  </TableCell>
                  <TableCell>{getStatusBadge(entry.status)}</TableCell>
                  <TableCell>{format(new Date(entry.blacklisted_date), "MMM d, yyyy")}</TableCell>
                  <TableCell className="max-w-xs truncate">{entry.blacklist_reason}</TableCell>
                  <TableCell>
                    {entry.next_review_date ? (
                      format(new Date(entry.next_review_date), "MMM d, yyyy")
                    ) : (
                      <span className="text-muted-foreground">N/A</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleViewDetails(entry)}>
                          View Details
                        </DropdownMenuItem>
                        {entry.status === 'blacklisted' && (
                          <DropdownMenuItem onClick={() => handleClearSupplier(entry)}>
                            Clear Supplier
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

      {/* Dialogs */}
      <BlacklistSupplierDialog 
        open={showBlacklistDialog} 
        onOpenChange={setShowBlacklistDialog}
      />
      
      {selectedEntry && (
        <>
          <ClearBlacklistDialog
            open={showClearDialog}
            onOpenChange={setShowClearDialog}
            blacklistEntry={selectedEntry}
          />
          <BlacklistDetailsDialog
            open={showDetailsDialog}
            onOpenChange={setShowDetailsDialog}
            blacklistEntry={selectedEntry}
          />
        </>
      )}
    </div>
  );
}
