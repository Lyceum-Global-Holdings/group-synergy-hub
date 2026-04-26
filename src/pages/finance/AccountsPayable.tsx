import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, FileText, CreditCard, Clock, Download } from "lucide-react";
import { SupplierInvoiceList } from "@/components/finance/ap/SupplierInvoiceList";
import { SupplierPaymentList } from "@/components/finance/ap/SupplierPaymentList";
import { APAgingReport } from "@/components/finance/ap/APAgingReport";
import { CreateSupplierInvoiceDialog } from "@/components/finance/ap/CreateSupplierInvoiceDialog";
import { CreatePaymentDialog } from "@/components/finance/ap/CreatePaymentDialog";
import { GenerateReportButton } from "@/components/management/reports/GenerateReportButton";

export default function AccountsPayable() {
  const [activeTab, setActiveTab] = useState("invoices");
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Accounts Payable</h1>
          <p className="text-muted-foreground">
            Manage supplier invoices, payments, and aging analysis
          </p>
        </div>
        <div className="flex gap-2">
          <GenerateReportButton size="sm" template="FN-AP-AGE-001" />
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          {activeTab === "invoices" && (
            <Button onClick={() => setShowInvoiceDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Invoice
            </Button>
          )}
          {activeTab === "payments" && (
            <Button onClick={() => setShowPaymentDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Payment
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="invoices" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Invoices
          </TabsTrigger>
          <TabsTrigger value="payments" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Payments
          </TabsTrigger>
          <TabsTrigger value="aging" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Aging Report
          </TabsTrigger>
        </TabsList>

        <TabsContent value="invoices">
          <SupplierInvoiceList />
        </TabsContent>

        <TabsContent value="payments">
          <SupplierPaymentList />
        </TabsContent>

        <TabsContent value="aging">
          <APAgingReport />
        </TabsContent>
      </Tabs>

      <CreateSupplierInvoiceDialog 
        open={showInvoiceDialog} 
        onOpenChange={setShowInvoiceDialog} 
      />
      
      <CreatePaymentDialog 
        open={showPaymentDialog} 
        onOpenChange={setShowPaymentDialog} 
      />
    </div>
  );
}
