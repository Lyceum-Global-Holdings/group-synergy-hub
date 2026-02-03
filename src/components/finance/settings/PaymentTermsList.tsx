import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Edit } from "lucide-react";
import { usePaymentTerms } from "@/hooks/finance/usePaymentTerms";
import { CreatePaymentTermDialog } from "./CreatePaymentTermDialog";
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

export function PaymentTermsList() {
  const { paymentTerms, isLoading, deletePaymentTerm } = usePaymentTerms();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const formatTermDescription = (term: typeof paymentTerms extends (infer T)[] ? T : never) => {
    if (!term) return "";
    let desc = `Net ${term.credit_days} days`;
    if (term.discount_days && term.discount_percent) {
      desc = `${term.discount_percent}% if paid within ${term.discount_days} days, ${desc}`;
    }
    return desc;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Payment Terms</CardTitle>
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
            <CardTitle>Payment Terms</CardTitle>
            <CardDescription>
              Configure payment terms for invoices (e.g., Net 30, 2/10 Net 30)
            </CardDescription>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Term
          </Button>
        </CardHeader>
        <CardContent>
          {paymentTerms && paymentTerms.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Credit Days</TableHead>
                  <TableHead>Early Discount</TableHead>
                  <TableHead>Default</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentTerms.map((term) => (
                  <TableRow key={term.id}>
                    <TableCell className="font-medium">{term.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatTermDescription(term)}
                    </TableCell>
                    <TableCell>{term.credit_days}</TableCell>
                    <TableCell>
                      {term.discount_percent ? (
                        <span>{term.discount_percent}% / {term.discount_days} days</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {term.is_default && <Badge variant="secondary">Default</Badge>}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteId(term.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>No payment terms configured</p>
              <p className="text-sm mt-1">Add payment terms like "Net 30" or "2% 10 Net 30"</p>
            </div>
          )}
        </CardContent>
      </Card>

      <CreatePaymentTermDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payment Term?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Invoices using this term will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) deletePaymentTerm(deleteId);
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
