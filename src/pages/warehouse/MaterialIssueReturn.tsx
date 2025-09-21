import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, FileText, Eye, Edit, Trash2 } from 'lucide-react';
import { useMaterialIssues } from '@/hooks/useMaterialIssues';
import { useMaterialReturns } from '@/hooks/useMaterialReturns';
import { MaterialIssueDialog } from '@/components/warehouse/MaterialIssueDialog';
import { MaterialReturnDialog } from '@/components/warehouse/MaterialReturnDialog';
import { format } from 'date-fns';

const getStatusColor = (status: string) => {
  switch (status) {
    case 'draft':
      return 'secondary';
    case 'approved':
      return 'default';
    case 'issued':
    case 'returned':
      return 'default';
    case 'cancelled':
      return 'destructive';
    default:
      return 'secondary';
  }
};

export default function MaterialIssueReturn() {
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  
  const { materialIssues, isLoading: issuesLoading } = useMaterialIssues();
  const { materialReturns, isLoading: returnsLoading } = useMaterialReturns();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Material Issue & Return</h1>
          <p className="text-muted-foreground">
            Manage material issues and returns for warehouse operations
          </p>
        </div>
      </div>

      <Tabs defaultValue="issues" className="space-y-4">
        <TabsList>
          <TabsTrigger value="issues">Material Issues</TabsTrigger>
          <TabsTrigger value="returns">Material Returns</TabsTrigger>
        </TabsList>

        <TabsContent value="issues" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Material Issue Notes
                  </CardTitle>
                  <CardDescription>
                    Track materials issued from warehouse to departments or projects
                  </CardDescription>
                </div>
                <Button onClick={() => setIssueDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Issue
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {issuesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-sm text-muted-foreground">Loading...</div>
                </div>
              ) : materialIssues.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No material issues found</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Create your first material issue note to get started
                  </p>
                  <Button onClick={() => setIssueDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Material Issue
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>MIN Number</TableHead>
                      <TableHead>Issue Date</TableHead>
                      <TableHead>Issued To</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Total Value</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {materialIssues.map((issue) => (
                      <TableRow key={issue.id}>
                        <TableCell className="font-medium">{issue.min_number}</TableCell>
                        <TableCell>{format(new Date(issue.issue_date), 'MMM dd, yyyy')}</TableCell>
                        <TableCell>{issue.issued_to}</TableCell>
                        <TableCell>{issue.department || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusColor(issue.status)}>
                            {issue.status.charAt(0).toUpperCase() + issue.status.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {issue.total_value ? `LKR ${issue.total_value.toLocaleString()}` : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="returns" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Material Return Notes
                  </CardTitle>
                  <CardDescription>
                    Track materials returned to warehouse from departments or suppliers
                  </CardDescription>
                </div>
                <Button onClick={() => setReturnDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Return
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {returnsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-sm text-muted-foreground">Loading...</div>
                </div>
              ) : materialReturns.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No material returns found</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Create your first material return note to get started
                  </p>
                  <Button onClick={() => setReturnDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Material Return
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>MRN Number</TableHead>
                      <TableHead>Return Date</TableHead>
                      <TableHead>Returned By</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Total Value</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {materialReturns.map((returnNote) => (
                      <TableRow key={returnNote.id}>
                        <TableCell className="font-medium">{returnNote.mrn_number}</TableCell>
                        <TableCell>{format(new Date(returnNote.return_date), 'MMM dd, yyyy')}</TableCell>
                        <TableCell>{returnNote.returned_by}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {returnNote.return_type.charAt(0).toUpperCase() + returnNote.return_type.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell>{returnNote.reason}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusColor(returnNote.status)}>
                            {returnNote.status.charAt(0).toUpperCase() + returnNote.status.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {returnNote.total_value ? `LKR ${returnNote.total_value.toLocaleString()}` : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <MaterialIssueDialog
        open={issueDialogOpen}
        onOpenChange={setIssueDialogOpen}
      />

      <MaterialReturnDialog
        open={returnDialogOpen}
        onOpenChange={setReturnDialogOpen}
      />
    </div>
  );
}