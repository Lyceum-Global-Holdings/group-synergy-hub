import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { useCustomerPurchaseOrders } from "@/hooks/useCustomerPurchaseOrders";
import { useCompany } from "@/contexts/CompanyContext";
import CreateCustomerPoDialog from "@/components/tuh-modules/customer-po/CreateCustomerPoDialog";
import CustomerPoDetailsDialog from "@/components/tuh-modules/customer-po/CustomerPoDetailsDialog";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";

const statusColors = {
  draft: "default",
  pending_approval: "secondary",
  confirmed: "default",
  rejected: "destructive",
  in_production: "outline",
  delivered: "default",
  completed: "default",
  cancelled: "destructive"
} as const;

export default function CustomerPO() {
  const { selectedCompany, isViewingAllCompanies } = useCompany();
  const { customerPOs, isLoading } = useCustomerPurchaseOrders(
    isViewingAllCompanies ? undefined : selectedCompany?.id
  );
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState<string | null>(null);

  const columns = [
    {
      accessorKey: "cpo_number",
      header: "CPO Number",
    },
    {
      accessorKey: "customer.customer_name",
      header: "Customer",
      cell: ({ row }: any) => row.original.customer?.customer_name || "N/A",
    },
    {
      accessorKey: "po_date",
      header: "PO Date",
      cell: ({ row }: any) => new Date(row.original.po_date).toLocaleDateString(),
    },
    {
      accessorKey: "delivery_date",
      header: "Delivery Date",
      cell: ({ row }: any) => 
        row.original.delivery_date 
          ? new Date(row.original.delivery_date).toLocaleDateString()
          : "Not set",
    },
    {
      accessorKey: "total_amount",
      header: "Total Amount",
      cell: ({ row }: any) => formatCurrency(row.original.total_amount),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }: any) => (
        <Badge variant={statusColors[row.original.status as keyof typeof statusColors]}>
          {row.original.status.replace('_', ' ').toUpperCase()}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }: any) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSelectedPO(row.original.id)}
        >
          View Details
        </Button>
      ),
    },
  ];

  const totalValue = customerPOs.reduce((sum, po) => sum + (po.total_amount || 0), 0);
  const totalCount = customerPOs.length;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customer Purchase Orders</h1>
          <p className="text-muted-foreground">
            Manage customer purchase orders and track order status
          </p>
        </div>
        <Button
          onClick={() => setCreateDialogOpen(true)}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Create Customer PO
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalValue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {customerPOs.filter(po => ['confirmed', 'in_production'].includes(po.status)).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {customerPOs.filter(po => po.status === 'pending_approval').length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Customer Purchase Orders</CardTitle>
          <CardDescription>
            View and manage all customer purchase orders
            {!isViewingAllCompanies && selectedCompany && 
              ` for ${selectedCompany.name}`
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={customerPOs}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>

      <CreateCustomerPoDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      {selectedPO && (
        <CustomerPoDetailsDialog
          cpoId={selectedPO}
          open={!!selectedPO}
          onOpenChange={() => setSelectedPO(null)}
        />
      )}
    </div>
  );
}