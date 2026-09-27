import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Contract } from "@/types/contracts";
import { format } from "date-fns";
import {
  FileText,
  Calendar,
  DollarSign,
  Users,
  AlertCircle,
  CheckCircle,
  Clock,
  Pencil,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContractDocumentsSection } from "./ContractDocumentsSection";
import { EditContractDialog } from "./EditContractDialog";
import { DeleteContractDialog } from "./DeleteContractDialog";
import { ChangeContractStatusDialog } from "./ChangeContractStatusDialog";
import { ContractRenewalPanel } from "./ContractRenewalPanel";

interface ContractDetailsDialogProps {
  contract: Contract;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ContractDetailsDialog = ({
  contract,
  open,
  onOpenChange,
}: ContractDetailsDialogProps) => {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isStatusChangeOpen, setIsStatusChangeOpen] = useState(false);
  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; icon: any }> = {
      draft: { variant: "secondary", icon: Clock },
      pending_approval: { variant: "outline", icon: Clock },
      approved: { variant: "default", icon: CheckCircle },
      active: { variant: "default", icon: CheckCircle },
      suspended: { variant: "destructive", icon: AlertCircle },
      expired: { variant: "secondary", icon: AlertCircle },
      terminated: { variant: "destructive", icon: AlertCircle },
      renewed: { variant: "default", icon: CheckCircle },
      closed: { variant: "secondary", icon: AlertCircle },
    };

    const config = variants[status] || variants.draft;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {status.replace("_", " ")}
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl">
                {contract.contract_title}
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {contract.contract_number}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge(contract.status)}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditOpen(true)}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsStatusChangeOpen(true)}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Change Status
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDeleteOpen(true)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="parties">Parties</TabsTrigger>
            <TabsTrigger value="terms">Terms</TabsTrigger>
            <TabsTrigger value="obligations">Obligations</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center space-y-0 pb-2">
                  <FileText className="h-4 w-4 text-muted-foreground mr-2" />
                  <CardTitle className="text-sm font-medium">Contract Type</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="capitalize">
                    {contract.contract_type.replace("_", " ")}
                  </p>
                  {contract.contract_category && (
                    <p className="text-sm text-muted-foreground">
                      {contract.contract_category}
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center space-y-0 pb-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground mr-2" />
                  <CardTitle className="text-sm font-medium">Contract Value</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg font-bold">
                    {contract.contract_value
                      ? `${contract.currency} ${contract.contract_value.toLocaleString()}`
                      : "Not specified"}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center space-y-0 pb-2">
                  <Calendar className="h-4 w-4 text-muted-foreground mr-2" />
                  <CardTitle className="text-sm font-medium">Effective Date</CardTitle>
                </CardHeader>
                <CardContent>
                  <p>{format(new Date(contract.effective_date), "PP")}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center space-y-0 pb-2">
                  <Calendar className="h-4 w-4 text-muted-foreground mr-2" />
                  <CardTitle className="text-sm font-medium">Expiry Date</CardTitle>
                </CardHeader>
                <CardContent>
                  <p>
                    {contract.expiry_date
                      ? format(new Date(contract.expiry_date), "PP")
                      : "Not specified"}
                  </p>
                </CardContent>
              </Card>
            </div>

            <ContractRenewalPanel contract={contract} />

            <Card>
              <CardHeader>
                <CardTitle>Counterparty Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">
                    {contract.counterparty_name || "Not specified"}
                  </span>
                </div>
                {contract.counterparty_email && (
                  <p className="text-sm text-muted-foreground">
                    {contract.counterparty_email}
                  </p>
                )}
                {contract.counterparty_contact && (
                  <p className="text-sm text-muted-foreground">
                    {contract.counterparty_contact}
                  </p>
                )}
              </CardContent>
            </Card>

            {contract.payment_terms && (
              <Card>
                <CardHeader>
                  <CardTitle>Payment Terms</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{contract.payment_terms}</p>
                </CardContent>
              </Card>
            )}

            {contract.notes && (
              <Card>
                <CardHeader>
                  <CardTitle>Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{contract.notes}</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="parties" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Contract Parties</CardTitle>
              </CardHeader>
              <CardContent>
                {contract.parties && contract.parties.length > 0 ? (
                  <div className="space-y-4">
                    {contract.parties.map((party) => (
                      <div key={party.id} className="border-b pb-4 last:border-0">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">{party.party_name}</h4>
                            <p className="text-sm text-muted-foreground capitalize">
                              {party.party_type.replace("_", " ")}
                              {party.party_role && ` - ${party.party_role}`}
                            </p>
                          </div>
                          {party.signed ? (
                            <Badge variant="default">Signed</Badge>
                          ) : (
                            <Badge variant="outline">Unsigned</Badge>
                          )}
                        </div>
                        {party.party_email && (
                          <p className="text-sm mt-2">{party.party_email}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No parties added yet
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="terms" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Contract Terms & Conditions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {contract.contract_terms && (
                  <div>
                    <h4 className="font-medium mb-2">Main Terms</h4>
                    <p className="text-sm whitespace-pre-wrap">
                      {contract.contract_terms}
                    </p>
                  </div>
                )}
                <Separator />
                {contract.special_conditions && (
                  <div>
                    <h4 className="font-medium mb-2">Special Conditions</h4>
                    <p className="text-sm whitespace-pre-wrap">
                      {contract.special_conditions}
                    </p>
                  </div>
                )}
                {contract.termination_terms && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-medium mb-2">Termination Terms</h4>
                      <p className="text-sm whitespace-pre-wrap">
                        {contract.termination_terms}
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="obligations" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Contract Obligations</CardTitle>
              </CardHeader>
              <CardContent>
                {contract.obligations && contract.obligations.length > 0 ? (
                  <div className="space-y-3">
                    {contract.obligations.map((obligation) => (
                      <div key={obligation.id} className="border-b pb-3 last:border-0">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-medium">{obligation.title}</h4>
                            {obligation.description && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {obligation.description}
                              </p>
                            )}
                            {obligation.due_date && (
                              <p className="text-sm mt-1">
                                Due: {format(new Date(obligation.due_date), "PP")}
                              </p>
                            )}
                          </div>
                          <Badge
                            variant={
                              obligation.status === "completed"
                                ? "default"
                                : obligation.status === "overdue"
                                ? "destructive"
                                : "outline"
                            }
                          >
                            {obligation.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No obligations added yet
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents" className="mt-4">
            <ContractDocumentsSection contractId={contract.id} />
          </TabsContent>
        </Tabs>

        <EditContractDialog
          open={isEditOpen}
          onOpenChange={setIsEditOpen}
          contract={contract}
        />

        <DeleteContractDialog
          open={isDeleteOpen}
          onOpenChange={setIsDeleteOpen}
          contract={contract}
          onSuccess={() => onOpenChange(false)}
        />

        <ChangeContractStatusDialog
          open={isStatusChangeOpen}
          onOpenChange={setIsStatusChangeOpen}
          contract={contract}
        />
      </DialogContent>
    </Dialog>
  );
};
