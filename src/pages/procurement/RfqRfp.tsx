import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, FileText, Send, Clock, CheckCircle, XCircle, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/ui/data-table";
import { useRfqRfpRequests } from "@/hooks/useRfqRfp";
import { useCompany } from "@/contexts/CompanyContext";
import { format } from "date-fns";
import { ColumnDef } from "@tanstack/react-table";
import { CreateRfqRfpDialog } from "@/components/procurement/CreateRfqRfpDialog";
import { RfqRfpDetailsDialog } from "@/components/procurement/RfqRfpDetailsDialog";
import type { RfqRfpRequest } from "@/types/rfqRfp";

export default function RfqRfp() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("all");
  const { selectedCompany } = useCompany();
  const { data: requests = [], isLoading } = useRfqRfpRequests(selectedCompany?.id);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft': return <FileText className="w-4 h-4 text-muted-foreground" />;
      case 'published': return <Send className="w-4 h-4 text-blue-500" />;
      case 'in_progress': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'evaluation': return <FileText className="w-4 h-4 text-purple-500" />;
      case 'awarded': return <Award className="w-4 h-4 text-green-500" />;
      case 'closed': return <CheckCircle className="w-4 h-4 text-gray-500" />;
      case 'cancelled': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      draft: "secondary",
      published: "default",
      in_progress: "default",
      evaluation: "default",
      awarded: "default",
      closed: "outline",
      cancelled: "destructive",
    };
    return <Badge variant={variants[status] || "default"}>{status.replace('_', ' ')}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const colors: Record<string, string> = {
      low: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
      medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
      high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
      urgent: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    };
    return (
      <Badge className={colors[priority] || ""} variant="outline">
        {priority}
      </Badge>
    );
  };

  const columns: ColumnDef<RfqRfpRequest>[] = [
    {
      accessorKey: "request_number",
      header: "Request Number",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {getStatusIcon(row.original.status)}
          <span className="font-medium">{row.original.request_number}</span>
        </div>
      ),
    },
    {
      accessorKey: "request_type",
      header: "Type",
      cell: ({ row }) => (
        <Badge variant="outline">{row.original.request_type.toUpperCase()}</Badge>
      ),
    },
    {
      accessorKey: "title",
      header: "Title",
    },
    {
      accessorKey: "priority",
      header: "Priority",
      cell: ({ row }) => getPriorityBadge(row.original.priority),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => getStatusBadge(row.original.status),
    },
    {
      accessorKey: "submission_deadline",
      header: "Deadline",
      cell: ({ row }) => format(new Date(row.original.submission_deadline), "PP"),
    },
    {
      accessorKey: "quotes",
      header: "Quotes",
      cell: ({ row }) => (
        <Badge variant="secondary">
          {row.original.quotes?.length || 0} quotes
        </Badge>
      ),
    },
    {
      accessorKey: "budget_estimate",
      header: "Budget",
      cell: ({ row }) => {
        if (!row.original.budget_estimate) return "-";
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: row.original.currency || 'LKR'
        }).format(row.original.budget_estimate);
      },
    },
    {
      accessorKey: "actions",
      header: "",
      cell: ({ row }) => (
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => {
            setSelectedRequestId(row.original.id);
            setDetailsDialogOpen(true);
          }}
        >
          View Details
        </Button>
      ),
    },
  ];

  const filterByStatus = (status?: string) => {
    if (!status || status === "all") return requests;
    return requests.filter(req => req.status === status);
  };

  const stats = [
    {
      label: "Total Requests",
      value: requests.length,
      icon: FileText,
      color: "text-blue-500",
    },
    {
      label: "Published",
      value: requests.filter(r => r.status === 'published').length,
      icon: Send,
      color: "text-green-500",
    },
    {
      label: "In Progress",
      value: requests.filter(r => r.status === 'in_progress').length,
      icon: Clock,
      color: "text-yellow-500",
    },
    {
      label: "Awarded",
      value: requests.filter(r => r.status === 'awarded').length,
      icon: Award,
      color: "text-purple-500",
    },
  ];

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">RFQ / RFP Management</h1>
            <p className="text-muted-foreground">
              Manage requests for quotations and proposals
            </p>
          </div>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create RFQ/RFP
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.label}
                </CardTitle>
                <Icon className={`w-4 h-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Requests Table */}
      <Card>
        <CardHeader>
          <CardTitle>RFQ/RFP Requests</CardTitle>
          <CardDescription>
            View and manage all your quotation and proposal requests
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="draft">Draft</TabsTrigger>
              <TabsTrigger value="published">Published</TabsTrigger>
              <TabsTrigger value="in_progress">In Progress</TabsTrigger>
              <TabsTrigger value="evaluation">Evaluation</TabsTrigger>
              <TabsTrigger value="awarded">Awarded</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-4">
              <DataTable
                columns={columns}
                data={filterByStatus(activeTab)}
                isLoading={isLoading}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <CreateRfqRfpDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
      <RfqRfpDetailsDialog 
        requestId={selectedRequestId}
        open={detailsDialogOpen} 
        onOpenChange={setDetailsDialogOpen} 
      />
    </div>
  );
}
