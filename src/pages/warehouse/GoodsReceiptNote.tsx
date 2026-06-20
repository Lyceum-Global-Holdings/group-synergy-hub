import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PackageCheck, Search, FileText, CheckCircle2, Clock, DollarSign, FileBarChart, Eye, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { VirtualTable, type DataTableColumn } from '@/components/shared/VirtualTable';
import { useCompany } from '@/contexts/CompanyContext';
import { useGoodsReceiptNotes, useGrnSummary } from '@/hooks/useGoodsReceiptNotes';
import { useCurrentUserRoles } from '@/hooks/useCurrentUserRoles';
import { GrnStatus } from '@/types/grn';
import { CreateGrnDialog } from '@/components/warehouse/CreateGrnDialog';
import { GrnDetailsDialog } from '@/components/warehouse/GrnDetailsDialog';
import { format } from 'date-fns';

const statusColors: Record<GrnStatus, string> = {
  draft: 'bg-gray-500',
  submitted: 'bg-yellow-500',
  approved: 'bg-green-500',
  completed: 'bg-blue-500',
  cancelled: 'bg-red-500',
  rejected: 'bg-red-600',
};

const statusLabels: Record<GrnStatus, string> = {
  draft: 'Draft',
  submitted: 'Pending Approval',
  approved: 'Approved',
  completed: 'Completed',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
};

function GoodsReceiptNote() {
  const { selectedCompany } = useCompany();
  const { data: grns = [], isLoading } = useGoodsReceiptNotes(selectedCompany?.id);
  const { data: summary } = useGrnSummary(selectedCompany?.id);
  const { data: userRoles = [] } = useCurrentUserRoles();
  const isAdmin = userRoles.some(role => role.role === 'admin' || role.role === 'super_admin');

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedGrn, setSelectedGrn] = useState<string | null>(null);
  const [editingGrnDraft, setEditingGrnDraft] = useState<any | null>(null);

  const filteredGrns = grns.filter(grn => {
    const matchesSearch =
      grn.grn_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      grn.po_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      grn.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || grn.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <PackageCheck className="h-8 w-8" />
            Goods Receipt Notes
          </h1>
          <p className="text-muted-foreground">
            Manage goods receipts and track inventory inbound
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/management/reports?template=WH-GRN-REG-001">
              <FileBarChart className="mr-2 h-4 w-4" />
              Generate Report
            </Link>
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <PackageCheck className="mr-2 h-4 w-4" />
            Create GRN
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total GRNs</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.total_grns || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.pending_approval || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved This Month</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.approved_this_month || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'LKR',
              }).format(summary?.total_value || 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by GRN number, PO number, or supplier..."
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
            <SelectItem value="submitted">Pending Approval</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* GRN Table */}
      <Card>
        <CardContent className="p-0">
          <VirtualTable
            ariaLabel="Goods receipt notes"
            data={filteredGrns}
            isLoading={isLoading}
            emptyMessage="No goods receipt notes found"
            getRowId={(grn) => grn.id}
            columns={[
              {
                key: 'grn_number',
                header: 'GRN Number',
                className: 'font-medium',
                render: (grn) => grn.grn_number,
              },
              {
                key: 'grn_date',
                header: 'Date',
                render: (grn) => format(new Date(grn.grn_date), 'PP'),
              },
              { key: 'po_number', header: 'PO Number', render: (grn) => grn.po_number || '-' },
              { key: 'supplier_name', header: 'Supplier', render: (grn) => grn.supplier_name || '-' },
              {
                key: 'status',
                header: 'Status',
                render: (grn) => (
                  <Badge className={statusColors[grn.status]}>{statusLabels[grn.status]}</Badge>
                ),
              },
              {
                key: 'total_value',
                header: 'Total Value',
                className: 'text-right',
                render: (grn) =>
                  new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'LKR',
                  }).format(grn.total_value || 0),
              },
              {
                key: 'received_by',
                header: 'Received By',
                render: (grn) => grn.received_by_profile?.full_name || '-',
              },
              {
                key: 'actions',
                header: 'Actions',
                className: 'text-right',
                render: (grn) => (
                  <Button variant="ghost" size="sm" onClick={() => setSelectedGrn(grn.id)}>
                    View Details
                  </Button>
                ),
              },
            ] as DataTableColumn<typeof filteredGrns[number]>[]}
          />
        </CardContent>
      </Card>

      <CreateGrnDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />

      {selectedGrn && (
        <GrnDetailsDialog
          grnId={selectedGrn}
          open={!!selectedGrn}
          onOpenChange={(open) => !open && setSelectedGrn(null)}
        />
      )}
    </div>
  );
}

export default GoodsReceiptNote;
