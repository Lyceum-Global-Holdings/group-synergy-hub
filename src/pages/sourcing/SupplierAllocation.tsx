import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Search, CheckCircle, XCircle, Clock } from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";
import { useCompanySuppliers } from "@/hooks/useCompanySuppliers";
import { useSuppliers } from "@/hooks/useSuppliers";
import { AllocateSupplierDialog } from "@/components/sourcing/AllocateSupplierDialog";
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
import { useUpdateSupplierAllocation, useRemoveSupplierAllocation } from "@/hooks/useCompanySuppliers";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export default function SupplierAllocation() {
  const { selectedCompany } = useCompany();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [allocateDialogOpen, setAllocateDialogOpen] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [selectedAllocation, setSelectedAllocation] = useState<any>(null);

  const { data: allocations = [], isLoading } = useCompanySuppliers();
  const { data: allSuppliers = [] } = useSuppliers();
  const updateAllocation = useUpdateSupplierAllocation();
  const removeAllocation = useRemoveSupplierAllocation();

  const filteredAllocations = allocations.filter((allocation) => {
    const matchesSearch = allocation.supplier?.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || allocation.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "rejected":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "suspended":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const handleApprove = (allocation: any) => {
    updateAllocation.mutate({
      id: allocation.id,
      company_id: allocation.company_id,
      status: "approved",
    });
  };

  const handleReject = (allocation: any) => {
    updateAllocation.mutate({
      id: allocation.id,
      company_id: allocation.company_id,
      status: "rejected",
    });
  };

  const handleRemove = (allocation: any) => {
    setSelectedAllocation(allocation);
    setRemoveDialogOpen(true);
  };

  const confirmRemove = () => {
    if (selectedAllocation) {
      removeAllocation.mutate({
        id: selectedAllocation.id,
        company_id: selectedAllocation.company_id,
      });
      setRemoveDialogOpen(false);
      setSelectedAllocation(null);
    }
  };

  if (!selectedCompany) {
    return (
      <div className="p-6">
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Please select a company to view supplier allocations</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Supplier Allocation</h1>
          <p className="text-muted-foreground mt-2">
            Manage supplier access for {selectedCompany.name}
          </p>
        </div>
        <Button onClick={() => setAllocateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Allocate Supplier
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Total Allocated</div>
          <div className="text-2xl font-bold mt-2">{allocations.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Approved</div>
          <div className="text-2xl font-bold mt-2 text-green-600">
            {allocations.filter((a) => a.status === "approved").length}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Pending</div>
          <div className="text-2xl font-bold mt-2 text-yellow-600">
            {allocations.filter((a) => a.status === "pending").length}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Rejected</div>
          <div className="text-2xl font-bold mt-2 text-red-600">
            {allocations.filter((a) => a.status === "rejected").length}
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <div className="flex gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search suppliers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : filteredAllocations.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No supplier allocations found
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Supplier</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Allocation Type</TableHead>
                <TableHead>Preferred</TableHead>
                <TableHead>Allocated Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAllocations.map((allocation) => (
                <TableRow key={allocation.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{allocation.supplier?.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {allocation.supplier?.supplier_code}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="capitalize">
                    {allocation.supplier?.supplier_type?.replace(/_/g, " ")}
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(allocation.status)}>
                      <div className="flex items-center gap-1">
                        {getStatusIcon(allocation.status)}
                        <span className="capitalize">{allocation.status}</span>
                      </div>
                    </Badge>
                  </TableCell>
                  <TableCell className="capitalize">
                    {allocation.allocation_type}
                  </TableCell>
                  <TableCell>
                    {allocation.is_preferred && (
                      <Badge variant="outline" className="bg-blue-50">
                        Preferred
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {new Date(allocation.allocated_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {allocation.status === "pending" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleApprove(allocation)}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReject(allocation)}
                          >
                            Reject
                          </Button>
                        </>
                      )}
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleRemove(allocation)}
                      >
                        Remove
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <AllocateSupplierDialog
        open={allocateDialogOpen}
        onOpenChange={setAllocateDialogOpen}
        companyId={selectedCompany.id}
      />

      <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Supplier Allocation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this supplier allocation? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
