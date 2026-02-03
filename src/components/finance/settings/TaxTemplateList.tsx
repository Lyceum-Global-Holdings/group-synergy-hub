import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { useTaxTemplates } from "@/hooks/finance/useTaxTemplates";
import { CreateTaxTemplateDialog } from "./CreateTaxTemplateDialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export function TaxTemplateList() {
  const { taxTemplates, taxDetails, isLoading, deleteTemplate } = useTaxTemplates();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const getTemplateDetails = (templateId: string) => {
    return taxDetails?.filter(d => d.template_id === templateId) || [];
  };

  const getTaxTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'vat': return 'bg-blue-500/10 text-blue-500';
      case 'gst': return 'bg-green-500/10 text-green-500';
      case 'withholding': return 'bg-orange-500/10 text-orange-500';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tax Templates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Tax Templates</CardTitle>
            <CardDescription>
              Configure tax calculations for VAT, GST, and other taxes
            </CardDescription>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Template
          </Button>
        </CardHeader>
        <CardContent>
          {taxTemplates && taxTemplates.length > 0 ? (
            <div className="space-y-2">
              {taxTemplates.map((template) => {
                const details = getTemplateDetails(template.id);
                const isExpanded = expandedId === template.id;
                
                return (
                  <Collapsible
                    key={template.id}
                    open={isExpanded}
                    onOpenChange={() => setExpandedId(isExpanded ? null : template.id)}
                  >
                    <div className="border rounded-lg">
                      <div className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-4">
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          </CollapsibleTrigger>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{template.name}</span>
                              <Badge className={getTaxTypeColor(template.tax_type)}>
                                {template.tax_type.toUpperCase()}
                              </Badge>
                              {template.is_default && (
                                <Badge variant="secondary">Default</Badge>
                              )}
                            </div>
                            {template.description && (
                              <p className="text-sm text-muted-foreground">
                                {template.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            {details.length} component{details.length !== 1 ? 's' : ''}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteId(template.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      <CollapsibleContent>
                        <div className="border-t px-4 py-3 bg-muted/30">
                          {details.length > 0 ? (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Component</TableHead>
                                  <TableHead className="text-right">Rate %</TableHead>
                                  <TableHead>Included in Price</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {details.map((detail) => (
                                  <TableRow key={detail.id}>
                                    <TableCell>{detail.tax_component_name}</TableCell>
                                    <TableCell className="text-right font-mono">
                                      {detail.tax_rate}%
                                    </TableCell>
                                    <TableCell>
                                      {detail.is_included_in_price ? 'Yes' : 'No'}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          ) : (
                            <p className="text-sm text-muted-foreground text-center py-2">
                              No tax components configured
                            </p>
                          )}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>No tax templates configured</p>
              <p className="text-sm mt-1">Add templates for VAT, GST, or other taxes</p>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateTaxTemplateDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tax Template?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the template and all its components. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) deleteTemplate(deleteId);
                setDeleteId(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
