import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, FileCheck, Clock, CheckCircle, XCircle, UserCheck, Copy, ExternalLink, Link2, Settings, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SupplierRegistrationWizard from "@/components/sourcing/SupplierRegistrationWizard";
import ApprovalDashboard from "@/components/sourcing/ApprovalDashboard";
import FormBuilder from "@/components/sourcing/registration/FormBuilder";
import { useSupplierRegistrations } from "@/hooks/useSupplierRegistration";
import { useCompany } from "@/contexts/CompanyContext";
import { useSupplierPortalSettings, useSaveSupplierPortalSettings } from "@/hooks/useSupplierFormConfig";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const PROJECT_PUBLISHED_DOMAIN = "https://stores.lgh.lk";

function isValidHttpsUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export default function SupplierRegistration() {
  const navigate = useNavigate();
  const [showWizard, setShowWizard] = useState(false);
  const [wizardDraftId, setWizardDraftId] = useState<string | undefined>();
  const [activeTab, setActiveTab] = useState("registrations");
  const [configOpen, setConfigOpen] = useState(false);
  const [draftBaseUrl, setDraftBaseUrl] = useState("");
  const { selectedCompany } = useCompany();
  const { data: registrations = [], isLoading } = useSupplierRegistrations(selectedCompany?.id);
  const { data: portalSettings } = useSupplierPortalSettings(selectedCompany?.id);
  const saveSettings = useSaveSupplierPortalSettings();
  const { toast } = useToast();

  const companySlug = (selectedCompany?.code || "").toLowerCase();

  const publicRegistrationUrl = useMemo(() => {
    const base =
      portalSettings?.public_base_url?.replace(/\/+$/, "") ||
      PROJECT_PUBLISHED_DOMAIN ||
      window.location.origin;
    const slugQs = companySlug ? `?c=${encodeURIComponent(companySlug)}` : "";
    return `${base}/register-supplier${slugQs}`;
  }, [portalSettings?.public_base_url, companySlug]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(publicRegistrationUrl);
      toast({ title: "Link copied!", description: "Public registration link copied to clipboard" });
    } catch {
      toast({ title: "Failed to copy", description: "Please copy the link manually", variant: "destructive" });
    }
  };

  const openConfigure = () => {
    setDraftBaseUrl(portalSettings?.public_base_url || PROJECT_PUBLISHED_DOMAIN);
    setConfigOpen(true);
  };

  const saveConfig = async () => {
    if (!selectedCompany?.id) return;
    const trimmed = draftBaseUrl.trim().replace(/\/+$/, "");
    if (trimmed && !isValidHttpsUrl(trimmed)) {
      toast({ title: "Invalid URL", description: "Please enter a valid http(s) URL", variant: "destructive" });
      return;
    }
    try {
      await saveSettings.mutateAsync({ company_id: selectedCompany.id, public_base_url: trimmed || null });
      toast({ title: "Saved", description: "Public registration URL updated" });
      setConfigOpen(false);
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "draft": return <Clock className="w-4 h-4" />;
      case "pending_approval": return <FileCheck className="w-4 h-4" />;
      case "approved": return <CheckCircle className="w-4 h-4" />;
      case "rejected": return <XCircle className="w-4 h-4" />;
      default: return null;
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "rejected": return "destructive" as const;
      default: return "secondary" as const;
    }
  };

  if (showWizard) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setShowWizard(false)}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Registrations
          </Button>
        </div>
        <SupplierRegistrationWizard
          key={wizardDraftId ?? "new"}
          draftId={wizardDraftId}
          onComplete={() => { setShowWizard(false); navigate("/sourcing/supplier-registration"); }}
        />
      </div>
    );
  }

  if (activeTab === "approvals") {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setActiveTab("registrations")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Registrations
          </Button>
        </div>
        <ApprovalDashboard />
      </div>
    );
  }

  const draftRegistrations = registrations.filter((r) => r.status === "draft");
  const pendingRegistrations = registrations.filter((r) => r.status === "pending_approval");
  const processedRegistrations = registrations.filter((r) => ["approved", "rejected"].includes(r.status));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Supplier Registration</h1>
          <p className="text-muted-foreground">Register new suppliers with a guided workflow</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setActiveTab("approvals")}>
            <UserCheck className="w-4 h-4 mr-2" /> Approval Dashboard ({pendingRegistrations.length})
          </Button>
          <Button onClick={() => { setWizardDraftId(undefined); setShowWizard(true); }}>
            <Plus className="w-4 h-4 mr-2" /> New Registration
          </Button>
        </div>
      </div>

      <Card className="bg-accent/50 border-primary/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-primary" />
              <CardTitle>Public Registration Portal</CardTitle>
            </div>
            <Button variant="ghost" size="sm" onClick={openConfigure}>
              <Settings className="w-4 h-4 mr-2" /> Configure URL
            </Button>
          </div>
          <CardDescription>
            The public link is generated from your configured domain. Suppliers landing here will register against
            <strong> {selectedCompany?.name || "the selected company"}</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 p-3 bg-background rounded-md border">
            <code className="flex-1 text-sm break-all">{publicRegistrationUrl}</code>
            <Button variant="outline" size="sm" onClick={copyToClipboard}>
              <Copy className="w-4 h-4 mr-2" /> Copy
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.open(publicRegistrationUrl, "_blank", "noopener,noreferrer")}>
              <ExternalLink className="w-4 h-4 mr-2" /> Preview
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Submissions appear in the &quot;Pending Approval&quot; tab. The form fields shown to suppliers can be customised in the
            <strong> Form Builder</strong> tab below.
          </p>
        </CardContent>
      </Card>

      <Tabs defaultValue="drafts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="drafts">Drafts ({draftRegistrations.length})</TabsTrigger>
          <TabsTrigger value="pending">Pending Approval ({pendingRegistrations.length})</TabsTrigger>
          <TabsTrigger value="processed">Processed ({processedRegistrations.length})</TabsTrigger>
          <TabsTrigger value="builder"><Wrench className="w-4 h-4 mr-1" /> Form Builder</TabsTrigger>
        </TabsList>

        <TabsContent value="drafts" className="space-y-4">
          {draftRegistrations.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No draft registrations.</CardContent></Card>
          ) : (
            draftRegistrations.map((reg) => (
              <Card key={reg.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{reg.supplier_data.supplier_name || "Unnamed Supplier"}</CardTitle>
                      <CardDescription>
                        Created {format(new Date(reg.created_at), "MMM dd, yyyy")} · last saved {format(new Date(reg.updated_at), "MMM dd, yyyy HH:mm")}
                      </CardDescription>
                    </div>
                    <Badge variant={getStatusVariant(reg.status)}>
                      {getStatusIcon(reg.status)}
                      <span className="ml-2">{reg.status.replace("_", " ")}</span>
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setWizardDraftId(reg.id); setShowWizard(true); }}>
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
            <Card><CardContent className="py-8 text-center text-muted-foreground">No pending approvals.</CardContent></Card>
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
                      <span className="ml-2">{reg.status.replace("_", " ")}</span>
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
            <Card><CardContent className="py-8 text-center text-muted-foreground">No processed registrations yet.</CardContent></Card>
          ) : (
            processedRegistrations.map((reg) => (
              <Card key={reg.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{reg.supplier_data.supplier_name}</CardTitle>
                      <CardDescription>
                        {reg.status === "approved" ? "Approved" : "Rejected"}{" "}
                        {reg.reviewed_at ? format(new Date(reg.reviewed_at), "MMM dd, yyyy") : "-"}
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
                      <span className="font-medium">Rejection Reason: </span>{reg.rejection_reason}
                    </p>
                  </CardContent>
                )}
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="builder">
          {selectedCompany?.id ? (
            <FormBuilder companyId={selectedCompany.id} />
          ) : (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Select a company to configure its registration form.</CardContent></Card>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure Public URL</DialogTitle>
            <DialogDescription>
              Set the canonical domain used to generate the public supplier registration link. Use your published custom
              domain (e.g. https://stores.lgh.lk).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Public base URL</Label>
            <Input
              value={draftBaseUrl}
              onChange={(e) => setDraftBaseUrl(e.target.value)}
              placeholder="https://stores.lgh.lk"
            />
            <p className="text-xs text-muted-foreground">
              Resulting link: <code>{(draftBaseUrl || PROJECT_PUBLISHED_DOMAIN).replace(/\/+$/, "")}/register-supplier{companySlug ? `?c=${companySlug}` : ""}</code>
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigOpen(false)}>Cancel</Button>
            <Button onClick={saveConfig} disabled={saveSettings.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
