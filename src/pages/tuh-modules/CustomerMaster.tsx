import { useState } from "react";
import { Plus, Search, Filter, Users, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { useCustomers } from "@/hooks/useCustomers";
import { useCompany } from "@/contexts/CompanyContext";
import CreateCustomerDialog from "@/components/tuh-modules/customer-master/CreateCustomerDialog";
import { CustomerDetailsDialog } from "@/components/tuh-modules/customer-master/CustomerDetailsDialog";
import { Customer } from "@/types/customer";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";

const statusColors = {
  active: "default" as const,
  inactive: "secondary" as const,
};

export default function CustomerMaster() {
  const { selectedCompany } = useCompany();
  const { customers, isLoading } = useCustomers(selectedCompany?.id);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<'all' | 'person' | 'company'>('all');

  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = customer.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.customer_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone?.includes(searchTerm) ||
      customer.registration_number?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = filterType === 'all' || customer.customer_type === filterType;
    
    return matchesSearch && matchesType;
  });

  const columns: ColumnDef<Customer>[] = [
    {
      accessorKey: "customer_code",
      header: "Customer Code",
    },
    {
      accessorKey: "customer_name",
      header: "Customer Name",
    },
    {
      accessorKey: "customer_type",
      header: "Type",
      cell: ({ row }) => {
        const type = row.getValue("customer_type") as string;
        return (
          <div className="flex items-center gap-2">
            {type === 'company' ? (
              <Building2 className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Users className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="capitalize">{type}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => row.getValue("email") || "-",
    },
    {
      accessorKey: "phone",
      header: "Phone",
      cell: ({ row }) => row.getValue("phone") || "-",
    },
    {
      accessorKey: "registration_number",
      header: "Registration No.",
      cell: ({ row }) => {
        const customer = row.original;
        return customer.customer_type === 'company' ? (customer.registration_number || "-") : "-";
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as keyof typeof statusColors;
        return <Badge variant={statusColors[status]}>{status}</Badge>;
      },
    },
    {
      accessorKey: "created_at",
      header: "Created",
      cell: ({ row }) => format(new Date(row.getValue("created_at")), "MMM dd, yyyy"),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedCustomer(row.original)}
        >
          View Details
        </Button>
      ),
    },
  ];

  const totalCustomers = filteredCustomers.length;
  const activeCustomers = filteredCustomers.filter(c => c.status === 'active').length;
  const companyCustomers = filteredCustomers.filter(c => c.customer_type === 'company').length;
  const personCustomers = filteredCustomers.filter(c => c.customer_type === 'person').length;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Customer Master</h1>
          <p className="text-muted-foreground">
            Manage customer profiles and business registration documents
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Customer
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCustomers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Customers</CardTitle>
            <Badge variant="default" className="h-4 w-4 rounded-full" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCustomers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Companies</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{companyCustomers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Individuals</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{personCustomers}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search customers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-64"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as 'all' | 'person' | 'company')}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="all">All Types</option>
            <option value="person">Individuals</option>
            <option value="company">Companies</option>
          </select>
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={filteredCustomers}
        isLoading={isLoading}
      />

      {/* Dialogs */}
      <CreateCustomerDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      {selectedCustomer && (
        <CustomerDetailsDialog
          customer={selectedCustomer}
          open={!!selectedCustomer}
          onOpenChange={() => setSelectedCustomer(null)}
        />
      )}
    </div>
  );
}