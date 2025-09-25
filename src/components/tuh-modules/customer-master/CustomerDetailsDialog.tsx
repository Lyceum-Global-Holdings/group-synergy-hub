import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Customer } from "@/types/customer";
import { format } from "date-fns";
import { Building2, Users, Mail, Phone, MapPin, FileText, Calendar, User, Edit, Download } from "lucide-react";
import { EditCustomerDialog } from "./EditCustomerDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface CustomerDetailsDialogProps {
  customer: Customer;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CustomerDetailsDialog({ customer, open, onOpenChange }: CustomerDetailsDialogProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [downloadingDocument, setDownloadingDocument] = useState(false);

  const handleDownloadDocument = async () => {
    if (!customer.company_registration_document_url) return;

    try {
      setDownloadingDocument(true);
      const { data, error } = await supabase.storage
        .from('customer-documents')
        .download(customer.company_registration_document_url);

      if (error) throw error;

      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${customer.customer_name}_registration_document.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: "Document downloaded successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to download document",
        variant: "destructive",
      });
    } finally {
      setDownloadingDocument(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                {customer.customer_type === 'company' ? (
                  <Building2 className="h-5 w-5" />
                ) : (
                  <Users className="h-5 w-5" />
                )}
                {customer.customer_name}
              </DialogTitle>
              <Button onClick={() => setEditDialogOpen(true)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </div>
          </DialogHeader>

          <div className="space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Customer Code</label>
                    <p className="font-medium">{customer.customer_code}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Customer Type</label>
                    <div className="flex items-center gap-2">
                      {customer.customer_type === 'company' ? (
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Users className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="capitalize font-medium">{customer.customer_type}</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Status</label>
                    <div>
                      <Badge variant={customer.status === 'active' ? 'default' : 'secondary'}>
                        {customer.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {customer.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{customer.email}</span>
                    </div>
                  )}
                  {customer.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{customer.phone}</span>
                    </div>
                  )}
                  {customer.contact_person && (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>Contact: {customer.contact_person}</span>
                    </div>
                  )}
                  {customer.address && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{customer.address}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Type-Specific Information */}
            {customer.customer_type === 'company' ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Company Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {customer.registration_number && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Registration Number</label>
                        <p className="font-medium">{customer.registration_number}</p>
                      </div>
                    )}
                    {customer.tax_id && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Tax ID</label>
                        <p className="font-medium">{customer.tax_id}</p>
                      </div>
                    )}
                  </div>
                  
                  {customer.company_registration_document_url && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Business Registration Document</label>
                      <div className="mt-2">
                        <Button
                          variant="outline"
                          onClick={handleDownloadDocument}
                          disabled={downloadingDocument}
                          className="flex items-center gap-2"
                        >
                          {downloadingDocument ? (
                            <>
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                              Downloading...
                            </>
                          ) : (
                            <>
                              <Download className="h-4 w-4" />
                              Download BR Document
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Personal Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {customer.first_name && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">First Name</label>
                        <p className="font-medium">{customer.first_name}</p>
                      </div>
                    )}
                    {customer.last_name && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Last Name</label>
                        <p className="font-medium">{customer.last_name}</p>
                      </div>
                    )}
                    {customer.id_passport_number && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">ID/Passport Number</label>
                        <p className="font-medium">{customer.id_passport_number}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <Separator />

            {/* Audit Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Record Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Created</label>
                    <p className="font-medium">{format(new Date(customer.created_at), "PPpp")}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Last Updated</label>
                    <p className="font-medium">{format(new Date(customer.updated_at), "PPpp")}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      <EditCustomerDialog
        customer={customer}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
    </>
  );
}