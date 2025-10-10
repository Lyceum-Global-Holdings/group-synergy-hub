import { useState } from "react";
import { Plus, FileText, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { useContracts } from "@/hooks/useContracts";
import { CreateContractDialog } from "@/components/contracts/CreateContractDialog";
import { ContractDetailsDialog } from "@/components/contracts/ContractDetailsDialog";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Contract } from "@/types/contracts";
import { ColumnDef } from "@tanstack/react-table";

const Contracts = () => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);

  const { data: contracts, isLoading } = useContracts({
    status: statusFilter,
    contract_type: typeFilter,
    search,
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; icon: any }> = {
      draft: { variant: "secondary", icon: Clock },
      pending_approval: { variant: "outline", icon: Clock },
      approved: { variant: "default", icon: CheckCircle },
      active: { variant: "default", icon: CheckCircle },
      suspended: { variant: "destructive", icon: AlertCircle },
      expired: { variant: "secondary", icon: AlertCircle },
      terminated: { variant: "destructive", icon: AlertCircle },
      renewed: { variant: "default", icon: CheckCircle },
      closed: { variant: "secondary", icon: AlertCircle },
    };

    const config = variants[status] || variants.draft;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {status.replace("_", " ")}
      </Badge>
    );
  };

  const columns: ColumnDef<Contract>[] = [
    {
      accessorKey: "contract_number",
      header: "Contract Number",
      cell: ({ row }) => (
        <Button
          variant="link"
          className="p-0 h-auto font-medium"
          onClick={() => setSelectedContract(row.original)}
        >
          {row.original.contract_number}
        </Button>
      ),
    },
    {
      accessorKey: "contract_title",
      header: "Title",
    },
    {
      accessorKey: "contract_type",
      header: "Type",
      cell: ({ row }) => (
        <span className="capitalize">
          {row.original.contract_type.replace("_", " ")}
        </span>
      ),
    },
    {
      accessorKey: "counterparty_name",
      header: "Counterparty",
      cell: ({ row }) => row.original.counterparty_name || "-",
    },
    {
      accessorKey: "contract_value",
      header: "Value",
      cell: ({ row }) =>
        row.original.contract_value
          ? `${row.original.currency} ${row.original.contract_value.toLocaleString()}`
          : "-",
    },
    {
      accessorKey: "effective_date",
      header: "Effective Date",
      cell: ({ row }) => format(new Date(row.original.effective_date), "PP"),
    },
    {
      accessorKey: "expiry_date",
      header: "Expiry Date",
      cell: ({ row }) =>
        row.original.expiry_date
          ? format(new Date(row.original.expiry_date), "PP")
          : "-",
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => getStatusBadge(row.original.status),
    },
  ];

  const activeContracts = contracts?.filter((c) => c.status === "active") || [];
  const expiringContracts =
    contracts?.filter((c) => {
      if (!c.expiry_date) return false;
      const daysUntilExpiry = Math.ceil(
        (new Date(c.expiry_date).getTime() - new Date().getTime()) /
          (1000 * 60 * 60 * 24)
      );
      return daysUntilExpiry > 0 && daysUntilExpiry <= 90;
    }) || [];
  const totalValue =
    contracts?.reduce((sum, c) => sum + (c.contract_value || 0), 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Contract Repository</h1>
          <p className="text-muted-foreground">
            Manage all your contracts in one place
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Contract
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Contracts</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{contracts?.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Contracts</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeContracts.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{expiringContracts.length}</div>
            <p className="text-xs text-muted-foreground">Within 90 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {contracts?.[0]?.currency || "LKR"} {totalValue.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Contracts</CardTitle>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search contracts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64"
              />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="pending_approval">Pending Approval</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="terminated">Terminated</SelectItem>
                  <SelectItem value="renewed">Renewed</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Types</SelectItem>
                  <SelectItem value="supplier_contract">Supplier Contract</SelectItem>
                  <SelectItem value="customer_contract">Customer Contract</SelectItem>
                  <SelectItem value="service_agreement">Service Agreement</SelectItem>
                  <SelectItem value="employment_contract">Employment Contract</SelectItem>
                  <SelectItem value="nda">NDA</SelectItem>
                  <SelectItem value="lease_agreement">Lease Agreement</SelectItem>
                  <SelectItem value="partnership_agreement">Partnership Agreement</SelectItem>
                  <SelectItem value="framework_agreement">Framework Agreement</SelectItem>
                  <SelectItem value="software_license">Software License</SelectItem>
                  <SelectItem value="consulting_agreement">Consulting Agreement</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={contracts || []} isLoading={isLoading} />
        </CardContent>
      </Card>

      <CreateContractDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
      
      {selectedContract && (
        <ContractDetailsDialog
          contract={selectedContract}
          open={!!selectedContract}
          onOpenChange={(open) => !open && setSelectedContract(null)}
        />
      )}
    </div>
  );
};

export default Contracts;
