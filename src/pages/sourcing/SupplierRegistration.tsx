import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, FileCheck, Clock, CheckCircle, XCircle, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SupplierRegistrationWizard from "@/components/sourcing/SupplierRegistrationWizard";
import ApprovalDashboard from "@/components/sourcing/ApprovalDashboard";
import { useSupplierRegistrations } from "@/hooks/useSupplierRegistration";
import { useCompany } from "@/contexts/CompanyContext";
import { format } from "date-fns";

export default function SupplierRegistration() {
  const navigate = useNavigate();
  const [showWizard, setShowWizard] = useState(false);
  const [activeTab, setActiveTab] = useState("registrations");
  const { selectedCompany } = useCompany();
  const { data: registrations = [], isLoading } = useSupplierRegistrations(selectedCompany?.id);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft':
        return <Clock className="w-4 h-4" />;
      case 'pending_approval':
        return <FileCheck className="w-4 h-4" />;
      case 'approved':
        return <CheckCircle className="w-4 h-4" />;
      case 'rejected':
        return <XCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'draft':
        return 'secondary';
      case 'pending_approval':
        return 'default';
      case 'approved':
        return 'default';
      case 'rejected':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  if (showWizard) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setShowWizard(false)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Registrations
          </Button>
        </div>
        <SupplierRegistrationWizard 
          onComplete={() => {
            setShowWizard(false);
            navigate("/sourcing/supplier-registration");
          }}
        />
      </div>
    );
  }

  const draftRegistrations = registrations.filter(r => r.status === 'draft');
  const pendingRegistrations = registrations.filter(r => r.status === 'pending_approval');
  const processedRegistrations = registrations.filter(r => ['approved', 'rejected'].includes(r.status));

  if (activeTab === "approvals") {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setActiveTab("registrations")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Registrations
          </Button>
        </div>
        <ApprovalDashboard />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Supplier Registration</h1>
          <p className="text-muted-foreground">
            Register new suppliers with a guided workflow
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setActiveTab("approvals")}>
            <UserCheck className="w-4 h-4 mr-2" />
            Approval Dashboard ({pendingRegistrations.length})
          </Button>
          <Button onClick={() => setShowWizard(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Registration
          </Button>
        </div>
      </div>

      <Tabs defaultValue="drafts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="drafts">
            Drafts ({draftRegistrations.length})
          </TabsTrigger>
          <TabsTrigger value="pending">
            Pending Approval ({pendingRegistrations.length})
          </TabsTrigger>
          <TabsTrigger value="processed">
            Processed ({processedRegistrations.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="drafts" className="space-y-4">
          {draftRegistrations.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No draft registrations. Click "New Registration" to start.
              </CardContent>
            </Card>
          ) : (
            draftRegistrations.map((reg) => (
              <Card key={reg.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{reg.supplier_data.supplier_name || "Unnamed Supplier"}</CardTitle>
                      <CardDescription>
                        Created {format(new Date(reg.created_at), "MMM dd, yyyy")}
                      </CardDescription>
                    </div>
                    <Badge variant={getStatusVariant(reg.status)}>
                      {getStatusIcon(reg.status)}
                      <span className="ml-2">{reg.status.replace('_', ' ')}</span>
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-end gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowWizard(true)}
                    >
                      Continue
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="pending" className="space-y-4">
          {pendingRegistrations.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No pending approvals.
              </CardContent>
            </Card>
          ) : (
            pendingRegistrations.map((reg) => (
              <Card key={reg.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{reg.supplier_data.supplier_name}</CardTitle>
                      <CardDescription>
                        Submitted {reg.submitted_at ? format(new Date(reg.submitted_at), "MMM dd, yyyy") : "-"}
                      </CardDescription>
                    </div>
                    <Badge variant={getStatusVariant(reg.status)}>
                      {getStatusIcon(reg.status)}
                      <span className="ml-2">{reg.status.replace('_', ' ')}</span>
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-sm font-medium">Type</p>
                      <p className="text-sm text-muted-foreground">{reg.supplier_data.supplier_type}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Email</p>
                      <p className="text-sm text-muted-foreground">{reg.supplier_data.email}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="processed" className="space-y-4">
          {processedRegistrations.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No processed registrations yet.
              </CardContent>
            </Card>
          ) : (
            processedRegistrations.map((reg) => (
              <Card key={reg.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{reg.supplier_data.supplier_name}</CardTitle>
                      <CardDescription>
                        {reg.status === 'approved' ? 'Approved' : 'Rejected'} {reg.reviewed_at ? format(new Date(reg.reviewed_at), "MMM dd, yyyy") : "-"}
                      </CardDescription>
                    </div>
                    <Badge variant={getStatusVariant(reg.status)}>
                      {getStatusIcon(reg.status)}
                      <span className="ml-2">{reg.status}</span>
                    </Badge>
                  </div>
                </CardHeader>
                {reg.rejection_reason && (
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium">Rejection Reason: </span>
                      {reg.rejection_reason}
                    </p>
                  </CardContent>
                )}
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
