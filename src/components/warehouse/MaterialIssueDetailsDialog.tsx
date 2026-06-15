import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CheckCircle, XCircle, FileCheck, Truck, Package, ArrowDown, ArrowUp, Download } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { MaterialIssueNote, MaterialIssueItem } from '@/types/materialIssueReturn';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { IssueItemsDialog } from './IssueItemsDialog';
import { ReceiveItemsDialog } from './ReceiveItemsDialog';
import { SrnDocumentUploadField } from './SrnDocumentUploadField';
import { downloadMaterialIssuePdf } from '@/utils/materialIssuePdfExport';
import { useCompany } from '@/contexts/CompanyContext';
import { useCurrentUserRoles } from '@/hooks/useCurrentUserRoles';

interface MaterialIssueDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issueId: string | null;
}

export function MaterialIssueDetailsDialog({ open, onOpenChange, issueId }: MaterialIssueDetailsDialogProps) {
  const [issue, setIssue] = useState<MaterialIssueNote | null>(null);
  const [items, setItems] = useState<MaterialIssueItem[]>([]);
  const [itemNames, setItemNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedCompany, companies } = useCompany();
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const { data: userRoles = [] } = useCurrentUserRoles();
  const canApprove = userRoles.some(r => r.role === 'admin' || r.role === 'super_admin');

  const handleDownloadPdf = async () => {
    if (!issue) return;
    setDownloadingPdf(true);
    try {
      const company =
        companies?.find((c) => c.id === issue.company_id) ?? selectedCompany ?? null;

      const approverIds = [
        issue.hod_approved_by,
        issue.management_approved_by,
        (issue as any).issued_by,
        (issue as any).received_by,
      ].filter(Boolean) as string[];

      let nameById: Record<string, string> = {};
      if (approverIds.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', approverIds);
        nameById = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.full_name ?? '']));
      }

      const { data: { user } } = await supabase.auth.getUser();
      const generatedBy = user
        ? (await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle()).data
            ?.full_name ?? user.email
        : null;

      await downloadMaterialIssuePdf({
        issue,
        items,
        company,
        generatedByName: generatedBy ?? undefined,
        approverNames: {
          hod: issue.hod_approved_by ? nameById[issue.hod_approved_by] : null,
          management: issue.management_approved_by
            ? nameById[issue.management_approved_by]
            : null,
          issued: (issue as any).issued_by ? nameById[(issue as any).issued_by] : null,
          received: (issue as any).received_by ? nameById[(issue as any).received_by] : null,
        },
      });
    } catch (err) {
      console.error('PDF generation failed', err);
      toast({
        title: 'PDF download failed',
        description: 'Could not generate the Material Issue Note PDF.',
        variant: 'destructive',
      });
    } finally {
      setDownloadingPdf(false);
    }
  };

  const invalidateLists = () => {
    queryClient.invalidateQueries({ queryKey: ['material-issues'] });
    queryClient.invalidateQueries({ queryKey: ['cpo-material-issues'] });
    queryClient.invalidateQueries({ queryKey: ['daily-material-issues'] });
    if (issueId) queryClient.invalidateQueries({ queryKey: ['material-issue', issueId] });
  };

  useEffect(() => {
    if (issueId && open) {
      fetchIssueDetails();
    }
  }, [issueId, open]);

  const fetchIssueDetails = async () => {
    if (!issueId) return;
    
    setLoading(true);
    try {
      const { data: issueData, error: issueError } = await supabase
        .from('material_issue_notes')
        .select('*, warehouse_locations(name)')
        .eq('id', issueId)
        .single();

      if (issueError) throw issueError;
      setIssue(issueData as MaterialIssueNote);

      const { data: itemsData, error: itemsError } = await supabase
        .from('material_issue_items')
        .select('*')
        .eq('min_id', issueId)
        .order('line_number', { ascending: true });

      if (itemsError) throw itemsError;
      const list = itemsData || [];
      setItems(list);

      const ids = Array.from(new Set(list.map((i: any) => i.item_id).filter(Boolean)));
      if (ids.length) {
        const { data: names } = await supabase
          .from('warehouse_items_full')
          .select('id, name')
          .in('id', ids);
        setItemNames(Object.fromEntries((names ?? []).map((r: any) => [r.id, r.name ?? ''])));
      } else {
        setItemNames({});
      }
    } catch (error) {
      console.error('Error fetching issue details:', error);
      toast({
        title: 'Error',
        description: 'Failed to load material issue details',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApproveHOD = async () => {
    if (!issueId) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('material_issue_notes')
        .update({
          hod_approved_by: user.id,
          hod_approval_date: new Date().toISOString(),
          status: 'approved',
        })
        .eq('id', issueId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Material issue approved by HOD',
      });
      
      fetchIssueDetails();
      invalidateLists();
    } catch (error) {
      console.error('Error approving:', error);
      toast({
        title: 'Error',
        description: 'Failed to approve material issue',
        variant: 'destructive',
      });
    }
  };

  const handleApproveManagement = async () => {
    if (!issueId) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('material_issue_notes')
        .update({
          management_approved_by: user.id,
          management_approval_date: new Date().toISOString(),
        })
        .eq('id', issueId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Material issue approved by Management',
      });
      
      fetchIssueDetails();
      invalidateLists();
    } catch (error) {
      console.error('Error approving:', error);
      toast({
        title: 'Error',
        description: 'Failed to approve material issue',
        variant: 'destructive',
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'secondary';
      case 'approved': return 'default';
      case 'issued': return 'default';
      case 'cancelled': return 'destructive';
      default: return 'secondary';
    }
  };

  if (!issue) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="flex items-center justify-center py-8">
            {loading ? 'Loading...' : 'No data'}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Material Issue Note - {issue.min_number}</DialogTitle>
              <DialogDescription>
                Created on {format(new Date(issue.created_at), 'MMM dd, yyyy')}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadPdf}
                disabled={downloadingPdf}
              >
                <Download className="h-4 w-4 mr-1.5" />
                {downloadingPdf ? 'Generating…' : 'Download PDF'}
              </Button>
              <Badge variant={getStatusColor(issue.status)}>
                {issue.status.toUpperCase()}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="items">Items</TabsTrigger>
            <TabsTrigger value="approvals">Approvals</TabsTrigger>
            <TabsTrigger value="tracking">Tracking</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="border rounded-lg p-4 space-y-2">
                <h3 className="font-semibold">Requester Information</h3>
                <div className="text-sm space-y-1">
                  <div><span className="font-medium">Name:</span> {issue.requested_by || '-'}</div>
                  <div><span className="font-medium">Department:</span> {issue.department || '-'}</div>
                  <div><span className="font-medium">Contact:</span> {issue.contact_number || '-'}</div>
                  <div><span className="font-medium">Gate Pass No:</span> {issue.epf_number || '-'}</div>
                </div>
              </div>

              <div className="border rounded-lg p-4 space-y-2">
                <h3 className="font-semibold">Issue Details</h3>
                <div className="text-sm space-y-1">
                  <div><span className="font-medium">Issue Date:</span> {format(new Date(issue.issue_date), 'MMM dd, yyyy')}</div>
                  <div><span className="font-medium">Required Date:</span> {issue.items_required_date ? format(new Date(issue.items_required_date), 'MMM dd, yyyy') : '-'}</div>
                  <div><span className="font-medium">Job Number:</span> {issue.job_number || '-'}</div>
                  <div><span className="font-medium">PR Number:</span> {issue.pr_number || '-'}</div>
                  <div><span className="font-medium">Location:</span> {(issue as any).warehouse_locations?.name || '-'}</div>
                </div>
              </div>
            </div>

            <div className="border rounded-lg p-4 space-y-2">
              <h3 className="font-semibold">Purpose</h3>
              <p className="text-sm">{issue.purpose || 'No purpose specified'}</p>
            </div>

            {issue.notes && (
              <div className="border rounded-lg p-4 space-y-2">
                <h3 className="font-semibold">Notes</h3>
                <p className="text-sm">{issue.notes}</p>
              </div>
            )}

            {issue.company_id && (
              <div className="border rounded-lg p-4 space-y-2">
                <h3 className="font-semibold">SRN Evidence</h3>
                <SrnDocumentUploadField
                  companyId={issue.company_id}
                  minId={issue.id}
                  currentDocumentUrl={issue.srn_document_url ?? undefined}
                  persistOnChange
                  disabled={issue.status === 'cancelled'}
                  onUpload={(path) =>
                    setIssue((prev) => (prev ? { ...prev, srn_document_url: path || null } : prev))
                  }
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="items">
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Line</TableHead>
                    <TableHead>Item Code</TableHead>
                    <TableHead>Item Name</TableHead>
                    <TableHead>UOM</TableHead>
                    <TableHead className="text-right">Required</TableHead>
                    <TableHead className="text-right">Received</TableHead>
                    <TableHead className="text-right">Shortage/Excess</TableHead>
                    <TableHead>Issued At</TableHead>
                    <TableHead>Received At</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => {
                    const qtyRequired = item.quantity_required || item.quantity_issued;
                    const qtyReceived = item.quantity_received || 0;
                    const variance = qtyRequired - qtyReceived;
                    
                    const getStatusBadge = () => {
                      if (qtyReceived >= qtyRequired) {
                        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">✓ Complete</span>;
                      }
                      if (qtyReceived > 0) {
                        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">⚠ Partial</span>;
                      }
                      return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">○ Pending</span>;
                    };

                    return (
                      <TableRow key={item.id}>
                        <TableCell>{item.line_number || index + 1}</TableCell>
                        <TableCell>{item.item_code || '-'}</TableCell>
                        <TableCell>{item.description || '-'}</TableCell>
                        <TableCell>{item.unit_of_measure || 'pcs'}</TableCell>
                        <TableCell className="text-right">{qtyRequired}</TableCell>
                        <TableCell className="text-right font-medium">{qtyReceived}</TableCell>
                        <TableCell className={`text-right font-medium ${
                          variance > 0 ? 'text-destructive' : variance < 0 ? 'text-green-600' : 'text-muted-foreground'
                        }`}>
                          {variance === 0 ? (
                            '—'
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              {variance > 0 ? (
                                <>
                                  <ArrowDown className="h-3 w-3" />
                                  {Math.abs(variance).toFixed(2)}
                                </>
                              ) : (
                                <>
                                  <ArrowUp className="h-3 w-3" />
                                  {Math.abs(variance).toFixed(2)}
                                </>
                              )}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {item.issued_at ? new Date(item.issued_at).toLocaleString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          }) : '-'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {item.received_at ? new Date(item.received_at).toLocaleString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          }) : '-'}
                        </TableCell>
                        <TableCell>{getStatusBadge()}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="approvals" className="space-y-4">
            <div className="space-y-3">
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {issue.hod_approved_by ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-gray-400" />
                    )}
                    <div>
                      <div className="font-semibold">HOD Approval</div>
                      {issue.hod_approved_by ? (
                        <div className="text-sm text-muted-foreground">
                          Approved on {format(new Date(issue.hod_approval_date!), 'MMM dd, yyyy HH:mm')}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">Pending approval</div>
                      )}
                    </div>
                  </div>
                  {!issue.hod_approved_by && issue.status === 'draft' && canApprove && (
                    <Button onClick={handleApproveHOD} size="sm">
                      Approve as HOD
                    </Button>
                  )}
                  {!issue.hod_approved_by && issue.status === 'draft' && !canApprove && (
                    <span className="text-xs text-muted-foreground">Only admins can approve</span>
                  )}
                </div>
              </div>

              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {issue.management_approved_by ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-gray-400" />
                    )}
                    <div>
                      <div className="font-semibold">Management Approval</div>
                      {issue.management_approved_by ? (
                        <div className="text-sm text-muted-foreground">
                          Approved on {format(new Date(issue.management_approval_date!), 'MMM dd, yyyy HH:mm')}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">Pending approval</div>
                      )}
                    </div>
                  </div>
                  {!issue.management_approved_by && issue.hod_approved_by && canApprove && (
                    <Button onClick={handleApproveManagement} size="sm">
                      Approve as Management
                    </Button>
                  )}
                  {!issue.management_approved_by && issue.hod_approved_by && !canApprove && (
                    <span className="text-xs text-muted-foreground">Only admins can approve</span>
                  )}
                </div>
              </div>

              <div className="border rounded-lg p-4">
                <div className="flex items-center gap-3">
                  {issue.issued_by ? (
                    <FileCheck className="h-5 w-5 text-blue-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-gray-400" />
                  )}
                  <div>
                    <div className="font-semibold">Items Issued</div>
                    {issue.issued_by ? (
                      <div className="text-sm text-muted-foreground">
                        Issued by {issue.issued_by_name || 'Unknown'}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">Not yet issued</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="border rounded-lg p-4">
                <div className="flex items-center gap-3">
                  {issue.received_by ? (
                    <Truck className="h-5 w-5 text-purple-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-gray-400" />
                  )}
                  <div>
                    <div className="font-semibold">Items Received</div>
                    {issue.received_by ? (
                      <div className="text-sm text-muted-foreground">
                        Received by {issue.received_by_name || 'Unknown'} on{' '}
                        {format(new Date(issue.received_date!), 'MMM dd, yyyy HH:mm')}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">Not yet received</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="tracking">
            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="font-semibold">Status Timeline</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Created</span>
                  <span>{format(new Date(issue.created_at), 'MMM dd, yyyy HH:mm')}</span>
                </div>
                {issue.hod_approval_date && (
                  <div className="flex justify-between">
                    <span>HOD Approved</span>
                    <span>{format(new Date(issue.hod_approval_date), 'MMM dd, yyyy HH:mm')}</span>
                  </div>
                )}
                {issue.management_approval_date && (
                  <div className="flex justify-between">
                    <span>Management Approved</span>
                    <span>{format(new Date(issue.management_approval_date), 'MMM dd, yyyy HH:mm')}</span>
                  </div>
                )}
                {issue.received_date && (
                  <div className="flex justify-between">
                    <span>Items Received</span>
                    <span>{format(new Date(issue.received_date), 'MMM dd, yyyy HH:mm')}</span>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {(issue.status === 'approved' || issue.status === 'issued' || issue.status === 'partially_received') && (
          <div className="flex justify-end gap-2 pt-4 border-t">
            {issue.status === 'approved' && !issue.issued_by && (
              <Button onClick={() => setIssueDialogOpen(true)}>
                <Package className="h-4 w-4 mr-2" />
                Issue Items
              </Button>
            )}
            {(issue.status === 'issued' || issue.status === 'partially_received') && (
              <Button onClick={() => setReceiveDialogOpen(true)}>
                <Truck className="h-4 w-4 mr-2" />
                Receive Items
              </Button>
            )}
          </div>
        )}
      </DialogContent>

      {issueId && (
        <>
          <IssueItemsDialog
            open={issueDialogOpen}
            onOpenChange={setIssueDialogOpen}
            issueId={issueId}
            onSuccess={() => { fetchIssueDetails(); invalidateLists(); }}
          />
          <ReceiveItemsDialog
            open={receiveDialogOpen}
            onOpenChange={setReceiveDialogOpen}
            issueId={issueId}
            onSuccess={() => { fetchIssueDetails(); invalidateLists(); }}
          />
        </>
      )}
    </Dialog>
  );
}
