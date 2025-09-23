import React, { useState } from 'react';
import { Plus, Search, Eye, Edit, Trash2, FileText, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useGoodsReceiptNotes, useDeleteGoodsReceiptNote, useGrnSummaryStats } from '@/hooks/useGoodsReceiptNotes';
import { CreateGrnDialog } from '@/components/warehouse/CreateGrnDialog';
import { GrnDetailsDialog } from '@/components/warehouse/GrnDetailsDialog';
import { GoodsReceiptNote, GrnStatus } from '@/types/grn';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const statusStyles: Record<GrnStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  submitted: 'bg-blue-100 text-blue-800',
  approved: 'bg-green-100 text-green-800',
  completed: 'bg-gray-100 text-gray-800'
};

const statusLabels: Record<GrnStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  completed: 'Completed'
};

export default function GoodsReceiptNotePage() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [selectedGrn, setSelectedGrn] = useState<GoodsReceiptNote | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { grns, isLoading } = useGoodsReceiptNotes();
  const { data: summaryStats } = useGrnSummaryStats();
  const deleteGrnMutation = useDeleteGoodsReceiptNote();

  const filteredGrns = grns.filter(grn =>
    grn.grn_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    grn.supplier_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (grn.invoice_number && grn.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleViewDetails = (grn: GoodsReceiptNote) => {
    setSelectedGrn(grn);
    setShowDetailsDialog(true);
  };

  const handleDeleteGrn = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this GRN?')) {
      await deleteGrnMutation.mutateAsync(id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Goods Receipt Notes</h1>
          <p className="text-muted-foreground">
            Manage goods received from suppliers
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create GRN
        </Button>
      </div>

      {/* Summary Cards */}
      {summaryStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total GRNs</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryStats.total_grns}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Draft GRNs</CardTitle>
              <Edit className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryStats.draft_grns}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Approved GRNs</CardTitle>
              <Badge className="h-4 w-4 text-muted-foreground bg-transparent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryStats.approved_grns}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Value</CardTitle>
              <span className="text-xs text-muted-foreground">LKR</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summaryStats.total_value.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by GRN number, supplier, or invoice..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline">
          <Filter className="w-4 h-4 mr-2" />
          Filter
        </Button>
      </div>

      {/* GRN Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Goods Receipt Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>GRN Number</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Invoice No.</TableHead>
                <TableHead>PO Number</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Total Value</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-4">
                    Loading GRNs...
                  </TableCell>
                </TableRow>
              ) : filteredGrns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-4">
                    No GRNs found
                  </TableCell>
                </TableRow>
              ) : (
                filteredGrns.map((grn) => (
                  <TableRow key={grn.id}>
                    <TableCell className="font-medium">{grn.grn_number}</TableCell>
                    <TableCell>{format(new Date(grn.grn_date), 'MMM dd, yyyy')}</TableCell>
                    <TableCell>{grn.supplier_name}</TableCell>
                    <TableCell>{grn.invoice_number || '-'}</TableCell>
                    <TableCell>{grn.po_number || '-'}</TableCell>
                    <TableCell>
                      <Badge className={cn(statusStyles[grn.status])}>
                        {statusLabels[grn.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      LKR {grn.total_value.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(grn)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {grn.status === 'draft' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteGrn(grn.id)}
                            disabled={deleteGrnMutation.isPending}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <CreateGrnDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
      
      {selectedGrn && (
        <GrnDetailsDialog
          open={showDetailsDialog}
          onOpenChange={setShowDetailsDialog}
          grnId={selectedGrn.id}
        />
      )}
    </div>
  );
}