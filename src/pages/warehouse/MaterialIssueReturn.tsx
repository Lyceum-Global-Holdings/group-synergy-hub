import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, Eye } from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { useMaterialIssues } from "@/hooks/useMaterialIssues";
import { useMaterialReturns } from "@/hooks/useMaterialReturns";
import { useMaterialRequests } from "@/hooks/useMaterialRequests";
import { MaterialIssueNote, MaterialReturnNote, MaterialRequest } from "@/types/materialIssueReturn";
import { CreateMaterialIssueDialog } from "@/components/warehouse/CreateMaterialIssueDialog";
import { MaterialIssueDetailsDialog } from "@/components/warehouse/MaterialIssueDetailsDialog";
import { CreateMaterialReturnDialog } from "@/components/warehouse/CreateMaterialReturnDialog";
import { MaterialReturnDetailsDialog } from "@/components/warehouse/MaterialReturnDetailsDialog";
import { CreateMaterialRequestDialog } from "@/components/warehouse/CreateMaterialRequestDialog";
import { MaterialRequestDetailsDialog } from "@/components/warehouse/MaterialRequestDetailsDialog";
import { format } from "date-fns";

const getStatusColor = (status: string): "default" | "destructive" | "secondary" => {
  switch (status) {
    case 'draft':
      return 'secondary';
    case 'approved':
    case 'issued':
    case 'returned':
      return 'default';
    case 'cancelled':
    case 'rejected':
      return 'destructive';
    default:
      return 'secondary';
  }
};

export default function MaterialIssueReturn() {
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [requestDetailsOpen, setRequestDetailsOpen] = useState(false);
  const [returnDetailsOpen, setReturnDetailsOpen] = useState(false);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<MaterialRequest | null>(null);
  const [selectedReturn, setSelectedReturn] = useState<MaterialReturnNote | null>(null);

  const { materialIssues, isLoading: isLoadingIssues } = useMaterialIssues();
  const { materialReturns, isLoading: isLoadingReturns } = useMaterialReturns();
  const { materialRequests, isLoading: isLoadingRequests } = useMaterialRequests();

  const handleViewDetails = (issueId: string) => {
    setSelectedIssueId(issueId);
    setDetailsDialogOpen(true);
  };

  const requestColumns: ColumnDef<MaterialRequest>[] = [
    { accessorKey: "request_number", header: "Request #" },
    {
      accessorKey: "request_date",
      header: "Date",
      cell: ({ row }) => format(new Date(row.original.request_date), 'PP')
    },
    { accessorKey: "requested_by", header: "Requested By" },
    { accessorKey: "department", header: "Department" },
    {
      accessorKey: "cpo_number",
      header: "CPO Number",
      cell: ({ row }) => {
        const cpoNumber = row.original.cpo_number;
        return cpoNumber ? (
          <Badge variant="outline">{cpoNumber}</Badge>
        ) : (
          <span className="text-muted-foreground">-</span>
        );
      }
    },
    {
      accessorKey: "priority",
      header: "Priority",
      cell: ({ row }) => (
        <Badge variant="outline" className="capitalize">
          {row.original.priority}
        </Badge>
      )
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={getStatusColor(row.original.status)} className="capitalize">
          {row.original.status.replace(/_/g, ' ')}
        </Badge>
      )
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSelectedRequest(row.original);
            setRequestDetailsOpen(true);
          }}
        >
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  const issueColumns: ColumnDef<MaterialIssueNote>[] = [
    { accessorKey: "min_number", header: "MIN #" },
    {
      accessorKey: "issue_date",
      header: "Issue Date",
      cell: ({ row }) => format(new Date(row.original.issue_date), 'PP')
    },
    { accessorKey: "issued_to", header: "Issued To" },
    { accessorKey: "department", header: "Department" },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={getStatusColor(row.original.status)}>
          {row.original.status}
        </Badge>
      )
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <Button variant="ghost" size="sm" onClick={() => handleViewDetails(row.original.id)}>
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  const returnColumns: ColumnDef<MaterialReturnNote>[] = [
    { accessorKey: "mrn_number", header: "MRN #" },
    {
      accessorKey: "return_date",
      header: "Return Date",
      cell: ({ row }) => format(new Date(row.original.return_date), 'PP')
    },
    { accessorKey: "returned_by", header: "Returned By" },
    {
      accessorKey: "return_type",
      header: "Type",
      cell: ({ row }) => (
        <Badge variant="outline" className="capitalize">
          {row.original.return_type}
        </Badge>
      )
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={getStatusColor(row.original.status)}>
          {row.original.status}
        </Badge>
      )
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSelectedReturn(row.original);
            setReturnDetailsOpen(true);
          }}
        >
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Material Issue & Return</h1>
      </div>

      <Tabs defaultValue="requests" className="w-full">
        <TabsList>
          <TabsTrigger value="requests">Material Requests</TabsTrigger>
          <TabsTrigger value="issues">Material Issues</TabsTrigger>
          <TabsTrigger value="returns">Material Returns</TabsTrigger>
        </TabsList>

        {/* Material Requests Tab */}
        <TabsContent value="requests">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Material Requests</CardTitle>
                <Button onClick={() => setRequestDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  New Request
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={requestColumns}
                data={materialRequests || []}
                isLoading={isLoadingRequests}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Material Issues Tab */}
        <TabsContent value="issues">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Material Issues</CardTitle>
                <Button onClick={() => setIssueDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  New Issue
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={issueColumns}
                data={materialIssues || []}
                isLoading={isLoadingIssues}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Material Returns Tab */}
        <TabsContent value="returns">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Material Returns</CardTitle>
                <Button onClick={() => setReturnDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  New Return
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={returnColumns}
                data={materialReturns || []}
                isLoading={isLoadingReturns}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CreateMaterialRequestDialog
        open={requestDialogOpen}
        onOpenChange={setRequestDialogOpen}
      />
      <MaterialRequestDetailsDialog
        open={requestDetailsOpen}
        onOpenChange={setRequestDetailsOpen}
        request={selectedRequest}
      />
      <CreateMaterialIssueDialog
        open={issueDialogOpen}
        onOpenChange={setIssueDialogOpen}
      />
      <MaterialIssueDetailsDialog
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
        issueId={selectedIssueId}
      />
      <CreateMaterialReturnDialog
        open={returnDialogOpen}
        onOpenChange={setReturnDialogOpen}
      />
      <MaterialReturnDetailsDialog
        open={returnDetailsOpen}
        onOpenChange={setReturnDetailsOpen}
        returnNote={selectedReturn}
      />
    </div>
  );
}
